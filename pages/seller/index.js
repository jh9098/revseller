import { useEffect, useState } from 'react';
import SellerLayout from '../../components/seller/SellerLayout';
import { db } from '../../lib/firebase';
import { collection, onSnapshot, doc, getDoc } from 'firebase/firestore';

// FullCalendar 컴포넌트 임포트
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from "@fullcalendar/interaction";

const formatDate = (date) => date.toISOString().slice(0, 10);

function SellerHome() {
  const [events, setEvents] = useState([]);
  const [capacities, setCapacities] = useState({});

  useEffect(() => {
    // 1. 캠페인 데이터 실시간 로드
    const campaignUnsubscribe = onSnapshot(collection(db, 'campaigns'), async (snap) => {
      const fetchedEvents = await Promise.all(snap.docs.map(async (d) => {
        const data = d.data();
        const eventDate = data.date?.seconds ? new Date(data.date.seconds * 1000) : new Date(data.date);
        
        // 판매자 닉네임 가져오기
        const sellerSnap = await getDoc(doc(db, 'sellers', data.sellerUid));
        const nickname = sellerSnap.exists() ? (sellerSnap.data().nickname || sellerSnap.data().name) : '알수없음';

        return {
          id: d.id,
          title: `${nickname} (${data.quantity}개)`, // 이벤트 제목에 닉네임과 수량 표시
          start: eventDate,
          allDay: true,
          extendedProps: { // 추가 정보 저장
            quantity: data.quantity
          }
        };
      }));
      setEvents(fetchedEvents);
    });

    // 2. 작업 가능 개수 데이터 실시간 로드
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
  
  // 판매자용 달력 셀 렌더링 함수
  const renderSellerDayCell = (dayCellInfo) => {
    const dateStr = formatDate(dayCellInfo.date);
    const capacity = capacities[dateStr] || 0;
    
    const totalQuantity = events
      .filter(e => formatDate(new Date(e.start)) === dateStr)
      .reduce((sum, e) => sum + Number(e.extendedProps.quantity || 0), 0);
      
    const remaining = capacity - totalQuantity;
    const remainingColor = remaining > 0 ? 'text-blue-600' : 'text-red-600';

    return (
      <div className="p-1">
        <div className="text-right text-sm">{dayCellInfo.dayNumberText}</div>
        <div className="mt-4 text-center">
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
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: ''
          }}
          events={events}
          dayCellContent={renderSellerDayCell}
          locale="ko"
          height="auto"
          eventDisplay="block" // 이벤트를 블록 형태로 표시
        />
      </div>
    </SellerLayout>
  );
}

export default SellerHome;