import { useEffect, useState } from 'react';
import SellerLayout from '../../components/seller/SellerLayout';
import { db } from '../../lib/firebase';
import { collection, query, where, onSnapshot, Timestamp, getDoc, doc } from 'firebase/firestore';

export default function SellerHome() {
  const [schedule, setSchedule] = useState({});

  useEffect(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Monday as start
    const monday = new Date(today.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    const q = query(
      collection(db, 'campaigns'),
      where('date', '>=', Timestamp.fromDate(monday)),
      where('date', '<=', Timestamp.fromDate(sunday))
    );

    const unsubscribe = onSnapshot(q, async (snap) => {
      const temp = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 0: [] };
      for (const d of snap.docs) {
        const data = d.data();
        const campaignDate = data.date?.seconds ? new Date(data.date.seconds * 1000) : new Date(data.date);
        const sellerRef = doc(db, 'sellers', data.sellerUid);
        const sellerSnap = await getDoc(sellerRef);
        const name = sellerSnap.exists() ? sellerSnap.data().name : '알수없음';
        temp[campaignDate.getDay()].push({ id: d.id, name, quantity: data.quantity });
      }
      setSchedule(temp);
    });

    return () => unsubscribe();
  }, []);

  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

  return (
    <SellerLayout>
      <h2 className="text-2xl font-bold mb-4">예약 시트</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {dayNames.map((dayName, idx) => (
          <div key={dayName} className="bg-white p-4 rounded-lg shadow">
            <h3 className="font-semibold mb-2">{dayName}</h3>
            {schedule[idx] && schedule[idx].length > 0 ? (
              <ul className="text-sm space-y-1">
                {schedule[idx].map((c) => (
                  <li key={c.id} className="flex justify-between">
                    <span>{c.name} ({c.id.slice(0, 6)})</span>
                    <span>{c.quantity}개</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-400 text-sm">예약 없음</p>
            )}
          </div>
        ))}
      </div>
    </SellerLayout>
  );
}
