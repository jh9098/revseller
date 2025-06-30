import { useState } from 'react';
import { useRouter } from 'next/router';
import { auth, db } from '../lib/firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, collection, query, where, getDocs, serverTimestamp } from 'firebase/firestore';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [bNo, setBNo] = useState('');
  const [referrerId, setReferrerId] = useState('');
  const [username, setUsername] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const router = useRouter();

  const handleSignUpAndVerify = async (e) => {
    e.preventDefault();
    if (!email || !password || !bNo || !name || !phone || !username) {
      alert('모든 필드를 입력해주세요.');
      return;
    }
    setIsVerifying(true);
    try {
      const emailQuery = query(collection(db, 'sellers'), where('email', '==', email));
      const emailSnap = await getDocs(emailQuery);
      if (!emailSnap.empty) throw new Error('이미 사용 중인 이메일입니다.');

      const bNoQuery = query(collection(db, 'sellers'), where('businessInfo.b_no', '==', bNo));
      const bNoSnap = await getDocs(bNoQuery);
      if (!bNoSnap.empty) throw new Error('이미 등록된 사업자 번호입니다.');

      const response = await fetch('/api/business/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ b_no: bNo })
      });

      const data = await response.json();
      if (response.ok && data.b_stt_cd === '01') {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        const user = cred.user;
        await setDoc(doc(db, 'sellers', user.uid), {
          uid: user.uid,
          email,
          name,
          phone,
          username,
          referrerId,
          businessInfo: data,
          isVerified: true,
          paymentStatus: 'unpaid',
          paymentAmount: 50000,
          lastLogin: serverTimestamp()
        });
        alert(`${data.tax_type} 사업자 인증 및 가입이 완료되었습니다.`);
        router.push('/');
      } else {
        alert(`인증 실패: ${data.b_stt || data.message || '알 수 없는 오류'}`);
      }
    } catch (err) {
      console.error(err);
      alert(`가입 과정에서 오류가 발생했습니다: ${err.message}`);
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '400px', margin: 'auto' }}>
      <h1>회원가입</h1>
      <form onSubmit={handleSignUpAndVerify}>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="이름" style={{ width:'100%', padding:'8px', marginBottom:'10px' }} />
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="이메일" style={{ width:'100%', padding:'8px', marginBottom:'10px' }} />
        <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="전화번호" style={{ width:'100%', padding:'8px', marginBottom:'10px' }} />
        <input value={bNo} onChange={e => setBNo(e.target.value.replace(/-/g,''))} placeholder="사업자등록번호('-' 제외)" style={{ width:'100%', padding:'8px', marginBottom:'10px' }} />
        <input value={referrerId} onChange={e => setReferrerId(e.target.value)} placeholder="추천인 ID" style={{ width:'100%', padding:'8px', marginBottom:'10px' }} />
        <input value={username} onChange={e => setUsername(e.target.value)} placeholder="ID" style={{ width:'100%', padding:'8px', marginBottom:'10px' }} />
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="PW" style={{ width:'100%', padding:'8px', marginBottom:'10px' }} />
        <button type="submit" disabled={isVerifying} style={{ width:'100%', padding:'10px' }}>
          {isVerifying ? '인증 중...' : '가입하기'}
        </button>
      </form>
    </div>
  );
}
