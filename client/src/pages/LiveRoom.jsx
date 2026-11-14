import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { io } from 'socket.io-client';
import { api, getAccessToken, apiOrigin } from '../lib/api';
import { toast } from '../app/slices';
import { Spinner } from '../components/ui.jsx';

function Tile({ stream, name, muted, label, off }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current && stream) ref.current.srcObject = stream; }, [stream]);
  return (
    <div className="relative aspect-video overflow-hidden rounded-panel bg-board-deep">
      {stream ? <video ref={ref} autoPlay playsInline muted={muted} className={`h-full w-full object-cover ${off ? 'invisible' : ''}`} /> : null}
      {(!stream || off) && <div className="absolute inset-0 grid place-items-center font-display text-4xl font-bold text-chalk">{name ? name[0] : '?'}</div>}
      <div className="absolute bottom-2 left-2 rounded-field bg-black/60 px-2 py-1 text-xs text-white">{name}{label ? ` (${label})` : ''}</div>
    </div>
  );
}

// WebRTC mesh: every participant keeps one RTCPeerConnection per other participant.
// Socket.IO is used only for signaling (offers, answers, ICE candidates) and chat.
export default function LiveRoom() {
  const { classId } = useParams();
  const user = useSelector((s) => s.auth.user);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const socketRef = useRef(null);
  const peers = useRef(new Map()); // socketId -> { pc, name, role }
  const localRef = useRef(null);
  const iceRef = useRef([]);
  const [local, setLocal] = useState(null);
  const [remotes, setRemotes] = useState({}); // socketId -> { stream, name, role, video }
  const [chat, setChat] = useState([]);
  const [text, setText] = useState('');
  const [phase, setPhase] = useState('joining');
  const [error, setError] = useState('');
  const [mic, setMic] = useState(true);
  const [cam, setCam] = useState(true);
  const [role, setRole] = useState('student');

  const makePeer = useCallback((id, info, initiator) => {
    const pc = new RTCPeerConnection({ iceServers: iceRef.current });
    peers.current.set(id, { pc, ...info });
    pc.onicecandidate = (e) => { if (e.candidate) socketRef.current.emit('signal', { to: id, data: { candidate: e.candidate } }); };
    pc.ontrack = (e) => setRemotes((r) => ({ ...r, [id]: { ...(r[id] || info), stream: e.streams[0] } }));
    pc.onconnectionstatechange = () => { if (['failed', 'closed'].includes(pc.connectionState)) setRemotes((r) => { const n = { ...r }; delete n[id]; return n; }); };
    const stream = localRef.current;
    if (stream) stream.getTracks().forEach((t) => pc.addTrack(t, stream));
    if (initiator) {
      // if we have no camera/mic we still want to RECEIVE media
      if (!stream || stream.getAudioTracks().length === 0) pc.addTransceiver('audio', { direction: 'recvonly' });
      if (!stream || stream.getVideoTracks().length === 0) pc.addTransceiver('video', { direction: 'recvonly' });
    }
    setRemotes((r) => ({ ...r, [id]: { ...(r[id] || {}), ...info } }));
    return pc;
  }, []);

  const closePeer = useCallback((id) => {
    const p = peers.current.get(id);
    if (p) p.pc.close();
    peers.current.delete(id);
    setRemotes((r) => { const n = { ...r }; delete n[id]; return n; });
  }, []);

  useEffect(() => {
    let alive = true;
    const socket = io(`${apiOrigin()}/live`, { auth: { token: getAccessToken() }, transports: ['websocket'] });
    socketRef.current = socket;

    const start = async () => {
      try {
        const cfg = await api.get('/live-classes/ice-servers');
        iceRef.current = cfg.iceServers;
        try { localRef.current = await navigator.mediaDevices.getUserMedia({ audio: true, video: { width: 640, height: 360 } }); } catch (e) {
          try { localRef.current = await navigator.mediaDevices.getUserMedia({ audio: true }); setCam(false); } catch (e2) { dispatch(toast('Camera and microphone unavailable. You can watch and chat.', 'info')); setMic(false); setCam(false); }
        }
        if (!alive) return;
        setLocal(localRef.current);
        socket.emit('join', { classId }, async (ack) => {
          if (!alive) return;
          if (!ack.ok) { setError(ack.error); setPhase('error'); return; }
          setRole(ack.role);
          setChat(ack.history || []);
          setPhase('live');
          // the NEW joiner offers to everyone already in the room
          for (const p of ack.peers) {
            const pc = makePeer(p.socketId, { name: p.name, role: p.role }, true);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket.emit('signal', { to: p.socketId, data: { sdp: pc.localDescription } });
          }
        });
      } catch (e) { setError(e.message); setPhase('error'); }
    };

    socket.on('connect', start);
    socket.on('connect_error', (e) => { setError(e.message); setPhase('error'); });
    socket.on('peer-joined', (p) => setRemotes((r) => ({ ...r, [p.socketId]: { ...(r[p.socketId] || {}), name: p.name, role: p.role } })));
    socket.on('signal', async ({ from, data }) => {
      let entry = peers.current.get(from);
      if (data.sdp && data.sdp.type === 'offer') {
        const info = (entry && { name: entry.name, role: entry.role }) || { name: 'Participant', role: 'student' };
        const pc = entry ? entry.pc : makePeer(from, info, false);
        await pc.setRemoteDescription(data.sdp);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('signal', { to: from, data: { sdp: pc.localDescription } });
      } else if (data.sdp && data.sdp.type === 'answer' && entry) {
        await entry.pc.setRemoteDescription(data.sdp);
      } else if (data.candidate) {
        entry = peers.current.get(from);
        if (entry) { try { await entry.pc.addIceCandidate(data.candidate); } catch (e) { /* ignore late candidates */ } }
      }
    });
    socket.on('peer-left', ({ socketId }) => closePeer(socketId));
    socket.on('chat', (m) => setChat((c) => [...c, m]));
    socket.on('media-state', ({ socketId, video }) => setRemotes((r) => (r[socketId] ? { ...r, [socketId]: { ...r[socketId], video } } : r)));
    socket.on('class-ended', () => { dispatch(toast('The instructor ended the class.', 'info')); navigate('/dashboard'); });

    return () => {
      alive = false;
      socket.close();
      peers.current.forEach((p) => p.pc.close());
      peers.current.clear();
      if (localRef.current) localRef.current.getTracks().forEach((t) => t.stop());
    };
  }, [classId, makePeer, closePeer, dispatch, navigate]);

  const toggle = (kind) => {
    const stream = localRef.current;
    if (!stream) return;
    const tracks = kind === 'audio' ? stream.getAudioTracks() : stream.getVideoTracks();
    if (!tracks.length) return;
    const on = !tracks[0].enabled;
    tracks.forEach((t) => { t.enabled = on; });
    const nextMic = kind === 'audio' ? on : mic;
    const nextCam = kind === 'video' ? on : cam;
    setMic(nextMic); setCam(nextCam);
    socketRef.current.emit('media-state', { audio: nextMic, video: nextCam });
  };

  const send = (e) => { e.preventDefault(); if (text.trim()) { socketRef.current.emit('chat', { text }); setText(''); } };
  const endClass = async () => { try { await api.post(`/live-classes/${classId}/end`); } catch (e) { dispatch(toast(e.message, 'error')); } };

  if (phase === 'error') return <div className="mx-auto max-w-xl px-4 py-24 text-center"><h1 className="text-2xl font-bold">Couldn’t join this class</h1><p className="mt-2 text-ink-mute">{error}</p><button className="btn-primary mt-6" onClick={() => navigate(-1)}>Go back</button></div>;
  if (phase === 'joining') return <Spinner label="Joining class…" />;

  const remoteList = Object.entries(remotes);
  return (
    <div className="mx-auto grid max-w-7xl gap-4 px-4 py-6 lg:grid-cols-[1fr_320px]">
      <div>
        <div className={`grid gap-3 ${remoteList.length === 0 ? 'grid-cols-1 sm:grid-cols-2' : 'sm:grid-cols-2 xl:grid-cols-3'}`}>
          <Tile stream={local} name={user.name} label="you" muted off={!cam} />
          {remoteList.map(([id, r]) => <Tile key={id} stream={r.stream} name={r.name || 'Participant'} label={r.role === 'instructor' ? 'instructor' : ''} off={r.video === false} />)}
          {remoteList.length === 0 && <div className="grid aspect-video place-items-center rounded-panel border border-dashed border-line text-sm text-ink-mute">Waiting for others to join…</div>}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button className={mic ? 'btn-ghost' : 'btn-danger'} onClick={() => toggle('audio')} aria-pressed={!mic}>{mic ? 'Mute' : 'Unmute'}</button>
          <button className={cam ? 'btn-ghost' : 'btn-danger'} onClick={() => toggle('video')} aria-pressed={!cam}>{cam ? 'Turn camera off' : 'Turn camera on'}</button>
          <button className="btn-ghost" onClick={() => navigate('/dashboard')}>Leave</button>
          {role === 'instructor' && <button className="btn-danger ml-auto" onClick={endClass}>End class for everyone</button>}
        </div>
        <p className="mt-3 text-xs text-ink-mute">Up to 7 people per class (video goes directly between participants).</p>
      </div>

      <aside className="panel flex h-[70vh] flex-col" aria-label="Class chat">
        <h2 className="border-b border-line px-4 py-3 font-display font-bold">Class chat</h2>
        <ul className="flex-1 space-y-3 overflow-y-auto p-4 text-sm" aria-live="polite">
          {chat.length === 0 && <li className="text-ink-mute">No messages yet.</li>}
          {chat.map((m, i) => <li key={i}><span className={`font-semibold ${m.role === 'instructor' ? 'text-board' : ''}`}>{m.from}</span> <span className="text-xs text-ink-mute">{new Date(m.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span><br />{m.text}</li>)}
        </ul>
        <form onSubmit={send} className="flex gap-2 border-t border-line p-3">
          <input className="field" value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message" aria-label="Chat message" maxLength={500} />
          <button className="btn-primary">Send</button>
        </form>
      </aside>
    </div>
  );
}
