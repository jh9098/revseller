import { useState, useEffect } from 'react';
import { auth, db } from '../lib/firebase';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged, deleteUser } from 'firebase/auth';
import { doc, getDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { useRouter } from 'next/router';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [user, setUser] = useState(null); // 로그인 상태 확인용
  const router = useRouter();

  // 로그인 상태를 감지하여 이미 로그인했다면 대시보드로 보냄
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const user = cred.user;
      const sellerRef = doc(db, 'sellers', user.uid);
      const sellerSnap = await getDoc(sellerRef);
      if (sellerSnap.exists()) {
        const last = sellerSnap.data().lastLogin?.toDate();
        if (last && Date.now() - last.getTime() > 30 * 24 * 60 * 60 * 1000) {
          await deleteDoc(sellerRef);
          await deleteUser(user);
          alert('30일 이상 미접속으로 계정이 삭제되었습니다. 다시 가입해주세요.');
          return;
        }
        await updateDoc(sellerRef, { lastLogin: serverTimestamp() });
      }
      router.push('/seller');
    } catch (error) {
      alert(`로그인 실패: ${error.message}`);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    alert('로그아웃 되었습니다.');
  };


  return (
    <div style={{ padding: '20px', maxWidth: '400px', margin: 'auto' }}>
      <h1>판매자 센터</h1>

      {/* 이미 로그인한 경우 보여줄 화면 */}
      {user ? (
        <div style={{ border: '1px solid #ccc', padding: '20px', marginBottom: '20px', textAlign: 'center' }}>
          <p>{user.email}님, 환영합니다.</p>
          <button onClick={() => router.push('/seller')} style={{ width: '100%', padding: '10px', marginTop: '10px' }}>대시보드로 이동</button>
          <button onClick={handleLogout} style={{ width: '100%', padding: '10px', marginTop: '10px', backgroundColor: 'grey', color: 'white' }}>로그아웃</button>
        </div>
      ) : (
        <>
          <div style={{ border: '1px solid #ccc', padding: '20px', marginBottom: '20px' }}>
            <h2>로그인</h2>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="이메일" style={{ width: '100%', padding: '8px', marginBottom: '10px' }} />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="비밀번호" style={{ width: '100%', padding: '8px', marginBottom: '10px' }} />
            <button onClick={handleLogin} style={{ width: '100%', padding: '10px' }}>로그인</button>
            <button onClick={() => router.push('/signup')} style={{ width: '100%', padding: '10px', marginTop: '10px' }}>회원가입</button>
          </div>
        </>
      )}
    </div>
  );
}