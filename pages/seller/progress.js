import { useEffect, useState } from 'react';
import SellerLayout from '../../components/seller/SellerLayout';
import { db, auth } from '../../lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';

export default function ProgressPage() {
  const [user] = useAuthState(auth);
  const [campaigns, setCampaigns] = useState([]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'campaigns'), where('sellerUid', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snap) => {
      setCampaigns(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsubscribe();
  }, [user]);

  const getStatus = (c) => {
    if (c.status === '리뷰완료') return '리뷰완료';
    if (c.status === '구매완료') return '구매완료';
    const d = c.date?.seconds ? new Date(c.date.seconds * 1000) : new Date(c.date);
    return new Date() < d ? '진행전' : '진행중';
  };

  return (
    <SellerLayout>
      <h2 className="text-2xl font-bold mb-4">진행현황</h2>
      <table className="min-w-full bg-white rounded-lg shadow">
        <thead className="bg-gray-100">
          <tr>
            <th className="px-4 py-2 text-left text-sm">순번</th>
            <th className="px-4 py-2 text-left text-sm">진행일자</th>
            <th className="px-4 py-2 text-left text-sm">상품명</th>
            <th className="px-4 py-2 text-left text-sm">상태</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {campaigns.map((c, idx) => {
            const d = c.date?.seconds ? new Date(c.date.seconds * 1000) : new Date(c.date);
            return (
              <tr key={c.id} className="text-sm">
                <td className="px-4 py-2">{idx + 1}</td>
                <td className="px-4 py-2">{d.toLocaleDateString()}</td>
                <td className="px-4 py-2">{c.productName}</td>
                <td className="px-4 py-2">{getStatus(c)}</td>
              </tr>
            );
          })}
          {campaigns.length === 0 && (
            <tr><td colSpan="4" className="text-center py-4 text-gray-500">등록된 캠페인이 없습니다.</td></tr>
          )}
        </tbody>
      </table>
    </SellerLayout>
  );
}
