import { useEffect, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import withAdminAuth from '../../hoc/withAdminAuth';
import { db } from '../../lib/firebase';
import { collection, onSnapshot, doc, setDoc, getDoc } from 'firebase/firestore';

// FullCalendar 컴포넌트 임포트
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from "@fullcalendar/interaction"; // 날짜 클릭 이벤트를 위해 필요

// YYYY-MM-DD 형식으로 날짜 포맷하는 헬퍼 함수
const formatDate = (date) => date.toISOString().slice(0, 10);

function AdminSchedule() {
  const [events, setEvents] = useState([]);
  const [capacities, setCapacities] = useState({});

  useEffect(() => {
    // 1. 캠페인 데이터 실시간 로드
    const campaignUnsubscribe = onSnapshot(collection(db, 'campaigns'), (snap) => {
      const fetchedEvents = snap.docs.map(d => {
        const data = d.data();
        const eventDate = data.date?.seconds ? new Date(data.date.seconds * 1000) : new Date(data.date);
        return {
          id: d.id,
          title: `${data.productName} (${data.quantity}개)`,
          start: eventDate,
          allDay: true, // 하루 종일 이벤트로 표시
          extendedProps: {
            sellerUid: data.sellerUid
          }
        };
      });
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
  
  // ✅ 버그 수정: 입력 값을 즉시 업데이트하고 Firestore에 저장하는 함수
  const handleCapacityChange = async (dateStr, value) => {
    // 입력 값이 숫자만 포함하도록 정규식 사용
    const numValue = Number(value.replace(/[^0-9]/g, ''));
    
    // 1. 화면에 즉시 반영 (사용자 경험 향상)
    setCapacities(prev => ({ ...prev, [dateStr]: numValue }));
    
    // 2. Firestore에 저장 (debounce를 적용하면 더 좋지만, 지금은 즉시 저장)
    try {
      await setDoc(doc(db, 'capacities', dateStr), { capacity: numValue });
    } catch (error) {
      console.error("Capacity 업데이트 오류:", error);
    }
  };

  // ✅ FullCalendar의 각 날짜 셀을 렌더링하는 커스텀 함수
  const renderDayCell = (dayCellInfo) => {
    const dateStr = formatDate(dayCellInfo.date);
    const capacity = capacities[dateStr] || 0;
    
    // 해당 날짜에 있는 이벤트들의 총 작업 개수 계산
    const totalQuantity = events
      .filter(e => formatDate(new Date(e.start)) === dateStr)
      .reduce((sum, e) => sum + Number(e.extendedProps.quantity || 0), 0);
      
    const remaining = capacity - totalQuantity;

    return (
      <div className="p-1 h-full flex flex-col">
        <div className="text-right text-sm">{dayCellInfo.dayNumberText}</div>
        <div className="flex-grow">
          {/* 이벤트는 FullCalendar가 자동으로 렌더링해 줌 */}
        </div>
        <div className="mt-auto text-xs">
          <div className="text-gray-500">잔여: {remaining}</div>
          <input
            type="number"
            value={capacity}
            onChange={(e) => handleCapacityChange(dateStr, e.target.value)}
            onClick={(e) => e.stopPropagation()} // 클릭 이벤트가 달력으로 전파되는 것을 막음
            className="w-full text-center border rounded-sm p-0.5"
            placeholder="총량"
          />
        </div>
      </div>
    );
  };


  return (
    <AdminLayout>
      <h2 className="text-2xl font-bold mb-4">예약 시트 관리 (월간)</h2>
      <div className="bg-white p-4 rounded-lg shadow-md">
        {/* FullCalendar 컴포넌트 */}
        <FullCalendar
          plugins={[dayGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,dayGridWeek' // 월/주 보기 전환 버튼
          }}
          events={events} // 캠페인 데이터를 이벤트로 전달
          dayCellContent={renderDayCell} // 각 날짜 셀을 커스텀 함수로 렌더링
          locale="ko" // 한글 로케일 설정
          height="auto" // 내용에 맞게 높이 자동 조절
        />
      </div>
    </AdminLayout>
  );
}

export default withAdminAuth(AdminSchedule);