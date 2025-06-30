import { useEffect, useState } from 'react';
import SellerLayout from '../../components/seller/SellerLayout';
import { db } from '../../lib/firebase';
import { collection, query, where, onSnapshot, Timestamp, getDoc, doc } from 'firebase/firestore';

export default function SellerHome() {
  const [schedule, setSchedule] = useState({});
  const [totals, setTotals] = useState({});
  const [capacities, setCapacities] = useState({});
  const [weekDates, setWeekDates] = useState([]);

  useEffect(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(today.setDate(diff));
    monday.setHours(0, 0, 0, 0);

    const dates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      dates.push(d);
    }
    setWeekDates(dates);

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
      const sums = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 0: 0 };
      for (const d of snap.docs) {
        const data = d.data();
        const campaignDate = data.date?.seconds ? new Date(data.date.seconds * 1000) : new Date(data.date);
        const sellerRef = doc(db, 'sellers', data.sellerUid);
        const sellerSnap = await getDoc(sellerRef);
        const nickname = sellerSnap.exists() ? (sellerSnap.data().nickname || sellerSnap.data().name) : '알수없음';
        temp[campaignDate.getDay()].push({ id: d.id, nickname, quantity: data.quantity });
        sums[campaignDate.getDay()] += Number(data.quantity || 0);
      }
      setSchedule(temp);
      setTotals(sums);
    });

    const loadCaps = async () => {
      const caps = {};
      for (const d of dates) {
        const dateStr = d.toISOString().slice(0, 10);
        const snap = await getDoc(doc(db, 'capacities', dateStr));
        caps[dateStr] = snap.exists() ? snap.data().capacity : 0;
      }
      setCapacities(caps);
    };
    loadCaps();

    return () => unsubscribe();
  }, []);

  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

  return (
    <SellerLayout>
      <h2 className="text-2xl font-bold mb-4">예약 시트</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4">
        {weekDates.map((d) => {
          const idx = d.getDay();
          const dateStr = d.toISOString().slice(0,10);
          return (
          <div key={dateStr} className="bg-white p-4 rounded-lg shadow">
            <h3 className="font-semibold mb-2">{dayNames[idx]} {dateStr}</h3>
            {schedule[idx] && schedule[idx].length > 0 ? (
              <ul className="text-sm space-y-1">
                {schedule[idx].map((c) => (
                  <li key={c.id} className="flex justify-between">
                    <span>{c.nickname}</span>
                    <span>{c.quantity}개</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-400 text-sm">예약 없음</p>
            )}
            <div className="mt-2 text-right text-sm font-semibold">
              합계: {totals[idx] || 0}개 / 총 {capacities[dateStr] || 0} / 잔여 {(capacities[dateStr] || 0) - (totals[idx] || 0)}개
            </div>
          </div>
          );
        })}
      </div>
      <table className="mt-6 min-w-full bg-white rounded shadow">
        <thead className="bg-gray-100">
          <tr>
            <th className="px-4 py-2">날짜</th>
            <th className="px-4 py-2">총작업가능</th>
            <th className="px-4 py-2">진행예약</th>
            <th className="px-4 py-2">잔여예약</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {weekDates.map((d) => {
            const idx = d.getDay();
            const dateStr = d.toISOString().slice(0,10);
            return (
              <tr key={dateStr} className="text-center text-sm">
                <td className="px-4 py-2">{dayNames[idx]} {dateStr}</td>
                <td className="px-4 py-2">{capacities[dateStr] || 0}</td>
                <td className="px-4 py-2">{totals[idx] || 0}</td>
                <td className="px-4 py-2">{(capacities[dateStr] || 0) - (totals[idx] || 0)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </SellerLayout>
  );
}
