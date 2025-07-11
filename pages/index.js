import { useState, useEffect } from 'react';
import { auth, db } from '../lib/firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { useRouter } from 'next/router';

export default function LoginPage() {
  // 로그인용 state
  const [loginId, setLoginId] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showSignup, setShowSignup] = useState(false);

  // 회원가입용 state (요청 순서에 맞게 새로 정의)
  const [username, setUsername] = useState(''); // ID
  const [password, setPassword] = useState(''); // PW
  const [name, setName] = useState('');         // 이름
  const [bNo, setBNo] = useState('');           // 사업자등록번호
  const [email, setEmail] = useState('');       // 이메일
  const [phone, setPhone] = useState('');         // 전화번호
  const [nickname, setNickname] = useState(''); // 닉네임
  const [referrerId, setReferrerId] = useState(''); // 추천인 ID

  const [isVerifying, setIsVerifying] = useState(false);
  const [user, setUser] = useState(null);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      const q = query(collection(db, 'sellers'), where('username', '==', loginId));
      const snap = await getDocs(q);
      if (snap.empty) throw new Error('존재하지 않는 ID입니다.');
      const { email } = snap.docs[0].data();
      await signInWithEmailAndPassword(auth, email, loginPassword);
      router.push('/seller');
    } catch (error) {
      alert('아이디/비밀번호를 다시 입력해 주세요.');
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    alert('로그아웃 되었습니다.');
  };

  const handleSignUpAndVerify = async (e) => {
    e.preventDefault();
    if (!username || !password || !name || !bNo || !email || !phone || !nickname) {
      alert('추천인 ID를 제외한 모든 필드를 입력해주세요.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      alert('올바른 이메일 형식을 입력해주세요.');
      return;
    }
    setIsVerifying(true);

    try {
      // 이메일 및 사업자 번호 중복 확인 로직 (기존과 동일)
      const emailQuery = query(collection(db, 'sellers'), where('email', '==', email));
      if (!(await getDocs(emailQuery)).empty) throw new Error('이미 사용 중인 이메일입니다.');

      const bNoQuery = query(collection(db, 'sellers'), where('businessInfo.b_no', '==', bNo));
      if (!(await getDocs(bNoQuery)).empty) throw new Error('이미 등록된 사업자 번호입니다.');

      // 사업자 인증 API 호출
      const response = await fetch('/api/business/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ b_no: bNo })
      });
      const data = await response.json();

      if (response.ok && data.b_stt_cd === '01') {
        // Firebase Auth에는 이메일과 비밀번호로 계정 생성
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Firestore에는 모든 정보를 저장
        await setDoc(doc(db, "sellers", user.uid), {
          uid: user.uid,
          username, // ID
          email,
          name,
          phone,
          nickname,
          referrerId, // 추천인 ID
          businessInfo: data,
          isVerified: true,
          paymentStatus: 'unpaid',
          paymentAmount: 50000,
          role: 'seller' // 기본 역할 부여
        });
        
        alert(`${data.tax_type} 사업자 인증 및 가입이 완료되었습니다. 바로 로그인됩니다.`);
        router.push('/seller');

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

      {user ? (
        <div style={{ border: '1px solid #ccc', padding: '20px', marginBottom: '20px', textAlign: 'center' }}>
          <p>{user.email}님, 환영합니다.</p>
          <button onClick={() => router.push('/seller')} style={{ width: '100%', padding: '10px', marginTop: '10px' }}>대시보드로 이동</button>
          <button onClick={handleLogout} style={{ width: '100%', padding: '10px', marginTop: '10px', backgroundColor: 'grey', color: 'white' }}>로그아웃</button>
        </div>
      ) : (
        <>
          {/* 로그인 폼 */}
          <div style={{ border: '1px solid #ccc', padding: '20px', marginBottom: '20px' }}>
            <h2>로그인</h2>
            <input value={loginId} onChange={(e) => setLoginId(e.target.value)} placeholder="ID" style={{ width: '100%', padding: '8px', marginBottom: '10px' }} />
            <input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} placeholder="비밀번호" style={{ width: '100%', padding: '8px', marginBottom: '10px' }} />
            <button onClick={handleLogin} style={{ width: '100%', padding: '10px', marginBottom: '10px' }}>로그인</button>
            <button onClick={() => setShowSignup(!showSignup)} style={{ width: '100%', padding: '10px' }}>회원가입</button>
          </div>

          {/* 회원가입 폼 */}
          {showSignup && (
          <div style={{ border: '1px solid #ccc', padding: '20px' }}>
            <h2>회원가입 및 사업자 인증</h2>
            <form onSubmit={handleSignUpAndVerify}>
              <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="ID" required style={{ width: '100%', padding: '8px', marginBottom: '10px' }} />
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="PW" required style={{ width: '100%', padding: '8px', marginBottom: '10px' }} />
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="이름" required style={{ width: '100%', padding: '8px', marginBottom: '10px' }} />
              <input value={bNo} onChange={(e) => setBNo(e.target.value.replace(/-/g, ''))} placeholder="사업자등록번호 ('-' 제외)" required style={{ width: '100%', padding: '8px', marginBottom: '10px' }} />
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="이메일" required style={{ width: '100%', padding: '8px', marginBottom: '10px' }} />
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="전화번호" required style={{ width: '100%', padding: '8px', marginBottom: '10px' }} />
              <input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="닉네임" required style={{ width: '100%', padding: '8px', marginBottom: '10px' }} />
              <input value={referrerId} onChange={(e) => setReferrerId(e.target.value)} placeholder="추천인 ID (선택)" style={{ width: '100%', padding: '8px', marginBottom: '10px' }} />
              <button type="submit" disabled={isVerifying} style={{ width: '100%', padding: '10px' }}>
                {isVerifying ? '인증 중...' : '가입하기'}
              </button>
            </form>
          </div>
          )}
        </>
      )}
    </div>
  );
}