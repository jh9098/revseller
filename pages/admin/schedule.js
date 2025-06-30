import { useEffect, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import withAdminAuth from '../../hoc/withAdminAuth';
import { db } from '../../lib/firebase';
import { collection, query, where, onSnapshot, Timestamp, doc, getDoc, setDoc } from 'firebase/firestore';

const formatDate = (d) => {
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 10);
};

function AdminSchedule() {
  const [schedule, setSchedule] = useState({});
  const [totals, setTotals] = useState({});
  const [capacities, setCapacities] = useState({});
  const [weekDates, setWeekDates] = useState([]);

  useEffect(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(today.setDate(diff));
    monday.setHours(0,0,0,0);

    const days = [];
    for(let i=0;i<7;i++){
      const d = new Date(monday);
      d.setDate(monday.getDate()+i);
      days.push(d);
    }
    setWeekDates(days);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate()+6);
    sunday.setHours(23,59,59,999);

    const q = query(
      collection(db,'campaigns'),
      where('date','>=',Timestamp.fromDate(monday)),
      where('date','<=',Timestamp.fromDate(sunday))
    );

    const unsubscribe = onSnapshot(q, async (snap) => {
      const temp = {1:[],2:[],3:[],4:[],5:[],6:[],0:[]};
      const sums = {1:0,2:0,3:0,4:0,5:0,6:0,0:0};
      for(const d of snap.docs){
        const data = d.data();
        const cDate = data.date?.seconds ? new Date(data.date.seconds*1000) : new Date(data.date);
        const sellerSnap = await getDoc(doc(db,'sellers', data.sellerUid));
        const nickname = sellerSnap.exists() ? (sellerSnap.data().nickname || sellerSnap.data().name) : '알수없음';
        temp[cDate.getDay()].push({ id:d.id, nickname, quantity:data.quantity });
        sums[cDate.getDay()] += Number(data.quantity || 0);
      }
      setSchedule(temp);
      setTotals(sums);
    });

    const loadCaps = async () => {
      const caps = {};
      for(const d of days){
        const dateStr = formatDate(d);
        const snap = await getDoc(doc(db,'capacities',dateStr));
        caps[dateStr] = snap.exists()? snap.data().capacity : 0;
      }
      setCapacities(caps);
    };
    loadCaps();

    return () => unsubscribe();
  }, []);

  const handleCapChange = async (dateStr, value) => {
    const onlyNums = value.replace(/\D/g, '');
    await setDoc(doc(db,'capacities',dateStr), { capacity: Number(onlyNums) });
    setCapacities(prev => ({ ...prev, [dateStr]: Number(onlyNums) }));
  };

  const dayNames = ['일','월','화','수','목','금','토'];

  return (
    <AdminLayout>
      <h2 className="text-2xl font-bold mb-4">예약 시트 관리</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4">
        {weekDates.map(d => {
          const idx = d.getDay();
          const dateStr = formatDate(d);
          return (
            <div key={dateStr} className="bg-white p-4 rounded shadow">
              <h3 className="font-semibold mb-2">{dayNames[idx]} {dateStr}</h3>
              {schedule[idx] && schedule[idx].length>0 ? (
                <ul className="text-sm space-y-1">
                  {schedule[idx].map(c => (
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
                합계: {totals[idx] || 0}개
              </div>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={capacities[dateStr] || ''}
                onChange={e => handleCapChange(dateStr, e.target.value)}
                className="mt-2 w-full p-1 border rounded"
              />
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
          {weekDates.map(d => {
            const idx = d.getDay();
            const dateStr = formatDate(d);
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
    </AdminLayout>
  );
}

export default withAdminAuth(AdminSchedule);
