import { configureStore } from '@reduxjs/toolkit';
import { reducers, authLost } from './slices';
import { setAuthLostHandler } from '../lib/api';

export const store = configureStore({ reducer: reducers });
setAuthLostHandler(() => store.dispatch(authLost()));
