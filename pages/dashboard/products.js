import { useState, useEffect } from 'react';
import { db, auth } from '../../lib/firebase';
import { collection, addDoc, serverTimestamp, query, where, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/router';

export default function ProductsPage() {
  const [productName, setProductName] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [products, setProducts] = useState([]);
  const [user, setUser] = useState(null);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      } else {
        router.push('/');
      }
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    if (user) {
      const q = query(collection(db, "products"), where("sellerUid", "==", user.uid));
      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const productsData = [];
        querySnapshot.forEach((doc) => {
          productsData.push({ id: doc.id, ...doc.data() });
        });
        setProducts(productsData);
      });
      return () => unsubscribe();
    }
  }, [user]);

  const handleRegisterProduct = async (e) => {
    e.preventDefault();
    if (!user) {
      alert('로그인이 필요합니다.');
      return;
    }

    try {
      await addDoc(collection(db, "products"), {
        sellerUid: user.uid,
        name: productName,
        price: Number(price),
        description: description,
        createdAt: serverTimestamp(),
        status: 'pending'
      });
      
      alert(`상품이 등록되었습니다. 관리자 승인을 기다려주세요.`);
      setProductName('');
      setPrice('');
      setDescription('');

    } catch (error) {
      console.error("상품 등록 오류:", error);
      alert("상품 등록에 실패했습니다.");
    }
  };

  if (!user) {
    return <p>로딩 중...</p>;
  }

  return (
    <div style={{ padding: '20px' }}>
      <h1>상품 관리 (판매자: {user.email})</h1>
      
      <form onSubmit={handleRegisterProduct} style={{ border: '1px solid #ccc', padding: '20px', marginBottom: '20px' }}>
        <h2>새 상품 등록</h2>
        <input value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="상품명" required style={{ display: 'block', width: '95%', padding: '8px', marginBottom: '10px' }} />
        <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="가격" required style={{ display: 'block', width: '95%', padding: '8px', marginBottom: '10px' }} />
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="상품 설명" style={{ display: 'block', width: '95%', padding: '8px', marginBottom: '10px' }} />
        <button type="submit" style={{ padding: '10px 20px' }}>상품 등록하기</button>
      </form>
      
      <h2>등록된 상품 목록</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ border: '1px solid #ddd', padding: '8px' }}>상품명</th>
            <th style={{ border: '1px solid #ddd', padding: '8px' }}>가격</th>
            <th style={{ border: '1px solid #ddd', padding: '8px' }}>상태</th>
          </tr>
        </thead>
        <tbody>
          {products.map(p => (
            <tr key={p.id}>
              <td style={{ border: '1px solid #ddd', padding: '8px' }}>{p.name}</td>
              <td style={{ border: '1px solid #ddd', padding: '8px' }}>{p.price.toLocaleString()}원</td>
              <td style={{ border: '1px solid #ddd', padding: '8px' }}>{p.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
