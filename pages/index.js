import { useState, useEffect } from 'react';
import { auth, db } from '../lib/firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { useRouter } from 'next/router';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [bNo, setBNo] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
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
      await signInWithEmailAndPassword(auth, email, password);
      // alert('로그인 성공!'); // 알림창 제거
      router.push('/dashboard/products'); // 즉시 대시보드로 이동
    } catch (error) {
      alert(`로그인 실패: ${error.message}`);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    alert('로그아웃 되었습니다.');
  };

  const handleSignUpAndVerify = async (e) => {
    e.preventDefault();
    if (!email || !password || !bNo) {
      alert('모든 필드를 입력해주세요.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      alert('올바른 이메일 형식을 입력해주세요.');
      return;
    }
    setIsVerifying(true);

    try {
      // ✅ 1. 이메일 중복 확인 (Firestore 직접 조회)
      const emailQuery = query(collection(db, 'sellers'), where('email', '==', email));
      const emailQuerySnapshot = await getDocs(emailQuery);
      if (!emailQuerySnapshot.empty) {
        throw new Error('이미 사용 중인 이메일입니다.');
      }

      // ✅ 2. 사업자 번호 중복 확인 (Firestore 직접 조회)
      const bNoQuery = query(collection(db, 'sellers'), where('businessInfo.b_no', '==', bNo));
      const bNoQuerySnapshot = await getDocs(bNoQuery);
      if (!bNoQuerySnapshot.empty) {
        throw new Error('이미 등록된 사업자 번호입니다.');
      }

      // 3. 사업자 인증 API 호출
      const response = await fetch('/api/business/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ b_no: bNo })
      });

      const data = await response.json();

      if (response.ok && data.b_stt_cd === '01') {
        // 4. Firebase Auth 사용자 생성
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // 5. Firestore에 판매자 정보 저장
        await setDoc(doc(db, "sellers", user.uid), {
          uid: user.uid,
          email: user.email,
          businessInfo: data,
          isVerified: true,
          paymentStatus: 'unpaid',
          // 초기 결제 금액 설정. 관리자가 변경 가능
          paymentAmount: 50000 
        });

        alert(`${data.tax_type} 사업자 인증 및 가입이 완료되었습니다. 바로 로그인됩니다.`);
        router.push('/dashboard/products'); // 가입 후 바로 대시보드로 이동

      } else {
        alert(`인증 실패: ${data.b_stt || data.message || '알 수 없는 오류'}`);
      }
    } catch (error) {
      console.error(error);
      alert(`가입 과정에서 오류가 발생했습니다: ${error.message}`);
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '400px', margin: 'auto' }}>
      <h1>판매자 센터</h1>

      {/* 이미 로그인한 경우 보여줄 화면 */}
      {user ? (
        <div style={{ border: '1px solid #ccc', padding: '20px', marginBottom: '20px', textAlign: 'center' }}>
          <p>{user.email}님, 환영합니다.</p>
          <button onClick={() => router.push('/dashboard/products')} style={{ width: '100%', padding: '10px', marginTop: '10px' }}>대시보드로 이동</button>
          <button onClick={handleLogout} style={{ width: '100%', padding: '10px', marginTop: '10px', backgroundColor: 'grey', color: 'white' }}>로그아웃</button>
        </div>
      ) : (
        <>
          <div style={{ border: '1px solid #ccc', padding: '20px', marginBottom: '20px' }}>
            <h2>로그인</h2>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="이메일" style={{ width: '100%', padding: '8px', marginBottom: '10px' }} />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="비밀번호" style={{ width: '100%', padding: '8px', marginBottom: '10px' }} />
            <button onClick={handleLogin} style={{ width: '100%', padding: '10px' }}>로그인</button>
          </div>

          <div style={{ border: '1px solid #ccc', padding: '20px' }}>
            <h2>회원가입 및 사업자 인증</h2>
            <form onSubmit={handleSignUpAndVerify}>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="이메일 (위와 동일하게 사용)" style={{ width: '100%', padding: '8px', marginBottom: '10px' }} />
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="비밀번호 (위와 동일하게 사용)" style={{ width: '100%', padding: '8px', marginBottom: '10px' }} />
              <input value={bNo} onChange={(e) => setBNo(e.target.value.replace(/-/g, ''))} placeholder="사업자등록번호 ('-' 제외)" required style={{ width: '100%', padding: '8px', marginBottom: '10px' }} />
              <button type="submit" disabled={isVerifying} style={{ width: '100%', padding: '10px' }}>
                {isVerifying ? '인증 중...' : '가입 및 인증하기'}
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}