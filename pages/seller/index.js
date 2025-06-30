import { useEffect, useState } from 'react';
import SellerLayout from '../../components/seller/SellerLayout';
import { db } from '../../lib/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from "@fullcalendar/interaction";

// ✅ KST 시간 보정을 위한 헬퍼 함수
const KST_OFFSET = 9 * 60 * 60 * 1000;
const formatDateToKST = (date) => {
  const kstDate = new Date(date.getTime() + KST_OFFSET);
  return kstDate.toISOString().slice(0, 10);
};

function SellerHome() {
  const [events, setEvents] = useState([]);
  const [capacities, setCapacities] = useState({});

  useEffect(() => {
    const campaignUnsubscribe = onSnapshot(collection(db, 'campaigns'), (snap) => {
      const fetchedEvents = snap.docs.map(doc => {
        const data = doc.data();
        const eventDate = data.date?.seconds ? new Date(data.date.seconds * 1000) : new Date(data.date);
        return {
          id: doc.id,
          title: `${data.productName || '이름없음'} (${data.quantity || 0}개)`,
          start: eventDate,
          allDay: true,
          extendedProps: { quantity: data.quantity || 0 }
        };
      });
      setEvents(fetchedEvents);
    });

    const capacityUnsubscribe = onSnapshot(collection(db, 'capacities'), (snap) => {
      const fetchedCaps = {};
      snap.forEach(doc => {
        fetchedCaps[doc.id] = doc.data().capacity || 0;
      });
      setCapacities(fetchedCaps);
    });

    return () => {
      campaignUnsubscribe();
      capacityUnsubscribe();
    };
  }, []);
  
  const renderSellerDayCell = (dayCellInfo) => {
    // ✅ KST 기준 날짜 문자열 사용
    const dateStr = formatDateToKST(dayCellInfo.date);
    const capacity = capacities[dateStr] || 0;
    
    const totalQuantity = events
      // ✅ KST 기준 날짜 문자열로 비교
      .filter(e => formatDateToKST(new Date(e.start)) === dateStr)
      .reduce((sum, e) => sum + Number(e.extendedProps.quantity || 0), 0);
      
    const remaining = capacity - totalQuantity;
    const remainingColor = remaining > 0 ? 'text-blue-600' : 'text-red-600';

    return (
      <div className="p-1 text-center">
        <div className="text-sm">{dayCellInfo.dayNumberText}</div>
        <div className="mt-4">
            <span className="text-xs text-gray-500">잔여: </span>
            <span className={`font-bold ${remainingColor}`}>{remaining}</span>
        </div>
      </div>
    );
  };

  return (
    <SellerLayout>
      <h2 className="text-2xl font-bold mb-4">예약 현황 (월간)</h2>
      <div className="bg-white p-4 rounded-lg shadow-md">
        <FullCalendar
          plugins={[dayGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{ left: 'prev,next today', center: 'title', right: '' }}
          events={events}
          dayCellContent={renderSellerDayCell}
          locale="ko"
          height="auto"
          timeZone='local' // ✅ 시간대 설정 추가
        />
      </div>
    </SellerLayout>
  );
}

export default SellerHome;