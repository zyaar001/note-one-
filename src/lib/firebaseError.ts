import { FirebaseError } from 'firebase/app';
import { auth } from './firebase';

export interface FirestoreErrorInfo {
  error: string;
  operationType: 'create' | 'update' | 'delete' | 'list' | 'get' | 'write';
  path: string | null;
  authInfo: {
    userId: string;
    email: string;
    emailVerified: boolean;
    isAnonymous: boolean;
    providerInfo: { providerId: string; displayName: string; email: string; }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: FirestoreErrorInfo['operationType'], path: string | null) {
  if (error instanceof FirebaseError && error.code === 'permission-denied') {
    const user = auth.currentUser;
    const errorInfo: FirestoreErrorInfo = {
      error: error.message,
      operationType,
      path,
      authInfo: user ? {
        userId: user.uid,
        email: user.email || '',
        emailVerified: user.emailVerified,
        isAnonymous: user.isAnonymous,
        providerInfo: user.providerData.map(p => ({
          providerId: p.providerId,
          displayName: p.displayName || '',
          email: p.email || ''
        }))
      } : {
        userId: 'unauthenticated',
        email: '',
        emailVerified: false,
        isAnonymous: true,
        providerInfo: []
      }
    };
    throw new Error(JSON.stringify(errorInfo));
  }
  throw error;
}
