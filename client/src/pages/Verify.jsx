import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { Spinner } from '../components/ui.jsx';
import { dateTime } from '../lib/format';

export default function Verify() {
  const { certId } = useParams();
  const [res, setRes] = useState(null);
  useEffect(() => { api.get(`/certificates/verify/${certId}`).then(setRes).catch(() => setRes({ valid: false })); }, [certId]);
  if (!res) return <Spinner label="Checking certificate…" />;
  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      {res.valid ? (
        <div className="panel border-ok p-8">
          <p className="font-display text-sm font-semibold text-ok">Valid certificate</p>
          <h1 className="mt-2 text-3xl font-extrabold">{res.studentName}</h1>
          <p className="mt-2">completed <strong>{res.courseTitle}</strong>, taught by {res.instructorName}.</p>
          <p className="mt-4 text-sm text-ink-mute">Issued {dateTime(res.issuedAt)}. Certificate ID {res.certId}.</p>
        </div>
      ) : (
        <div className="panel border-coral p-8">
          <h1 className="text-2xl font-extrabold">Certificate not found</h1>
          <p className="mt-2 text-ink-mute">No certificate matches <strong>{certId}</strong>. Check the ID for typos.</p>
          <Link to="/" className="btn-primary mt-5">Go to LearnSphere</Link>
        </div>
      )}
    </div>
  );
}
