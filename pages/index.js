import { useState } from 'react';
import { auth, db } from '../lib/firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { useRouter } from 'next/router';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [bNo, setBNo] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const router = useRouter();

  const handleLogin = async () => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      alert('로그인 성공!');
      router.push('/dashboard/products');
    } catch (error) {
      alert(`로그인 실패: ${error.message}`);
    }
  };
  
  const handleSignUpAndVerify = async (e) => {
    e.preventDefault();
    if (!email || !password || !bNo) {
      alert('모든 필드를 입력해주세요.');
      return;
    }
    setIsVerifying(true);

    try {
        const response = await fetch('/api/business/verify', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ b_no: bNo })
        });

        const data = await response.json();
        
        if (response.ok && data.b_stt_cd === '01') {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            await setDoc(doc(db, "sellers", user.uid), {
                uid: user.uid,
                email: user.email,
                businessInfo: data,
                isVerified: true,
                paymentStatus: 'unpaid',
            });
            
            alert(`${data.tax_type} 사업자 인증이 완료되었습니다. 로그인해주세요.`);
            router.push('/'); // 로그인 페이지로 다시 안내

        } else {
            alert(`인증 실패: ${data.b_stt || data.message || '알 수 없는 오류'}`);
        }
    } catch (error) {
        console.error(error);
        alert('인증 과정에서 오류가 발생했습니다.');
    } finally {
        setIsVerifying(false);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '400px', margin: 'auto' }}>
      <h1>판매자 센터</h1>
      <div style={{ border: '1px solid #ccc', padding: '20px', marginBottom: '20px' }}>
        <h2>로그인</h2>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="이메일" style={{ width: '100%', padding: '8px', marginBottom: '10px' }} />
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="비밀번호" style={{ width: '100%', padding: '8px', marginBottom: '10px' }} />
        <button onClick={handleLogin} style={{ width: '100%', padding: '10px' }}>로그인</button>
      </div>
      
      <div style={{ border: '1px solid #ccc', padding: '20px' }}>
        <h2>회원가입 및 사업자 인증</h2>
        <form onSubmit={handleSignUpAndVerify}>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="이메일 (위와 동일하게 사용)" style={{ width: '100%', padding: '8px', marginBottom: '10px' }}/>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="비밀번호 (위와 동일하게 사용)" style={{ width: '100%', padding: '8px', marginBottom: '10px' }}/>
          <input value={bNo} onChange={(e) => setBNo(e.target.value.replace(/-/g, ''))} placeholder="사업자등록번호 ('-' 제외)" required style={{ width: '100%', padding: '8px', marginBottom: '10px' }} />
          <button type="submit" disabled={isVerifying} style={{ width: '100%', padding: '10px' }}>
            {isVerifying ? '인증 중...' : '가입 및 인증하기'}
          </button>
        </form>
      </div>
    </div>
  );
}
