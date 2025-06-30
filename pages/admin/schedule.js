import { useEffect, useState, useMemo } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import withAdminAuth from '../../hoc/withAdminAuth';
import { db } from '../../lib/firebase';
import { collection, onSnapshot, doc, setDoc } from 'firebase/firestore';

import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from "@fullcalendar/interaction";

const formatDate = (date) => date.toISOString().slice(0, 10);

function AdminSchedule() {
  const [events, setEvents] = useState([]);
  const [capacities, setCapacities] = useState({});
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Firestore 데이터 로드
  useEffect(() => {
    const campaignUnsubscribe = onSnapshot(collection(db, 'campaigns'), (snap) => {
      const fetchedEvents = snap.docs.map(d => {
        const data = d.data();
        const eventDate = data.date?.seconds ? new Date(data.date.seconds * 1000) : new Date(data.date);
        return {
          id: d.id,
          title: `${data.productName} (${data.quantity || 0}개)`,
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

  // ✅ 달력의 월이 변경될 때마다 currentMonth state 업데이트
  const handleDatesSet = (dateInfo) => {
    setCurrentMonth(dateInfo.start);
  };

  // ✅ 현재 선택된 월의 날짜 목록을 계산 (useMemo로 불필요한 재계산 방지)
  const currentMonthDates = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const dates = [];
    for (let i = 1; i <= daysInMonth; i++) {
      dates.push(formatDate(new Date(year, month, i)));
    }
    return dates;
  }, [currentMonth]);

  // ✅ 입력 값 처리 및 Firestore 저장 함수
  const handleCapacityChange = async (dateStr, value) => {
    const numericValue = Number(value.replace(/[^0-9]/g, ''));
    setCapacities(prev => ({ ...prev, [dateStr]: numericValue })); // 화면에 즉시 반영
    try {
      await setDoc(doc(db, 'capacities', dateStr), { capacity: numericValue }); // Firestore에 저장
    } catch (error) {
      console.error(`[${dateStr}] Capacity 업데이트 오류:`, error);
    }
  };

  // ✅ FullCalendar의 각 날짜 셀을 조회용으로만 렌더링
  const renderDayCell = (dayCellInfo) => {
    const dateStr = formatDate(dayCellInfo.date);
    const capacity = capacities[dateStr] || 0;
    
    const totalQuantity = events
      .filter(e => formatDate(new Date(e.start)) === dateStr)
      .reduce((sum, e) => sum + Number(e.extendedProps.quantity || 0), 0);
      
    const remaining = capacity - totalQuantity;
    const remainingColor = remaining > 0 ? 'text-blue-600' : 'text-red-600';

    return (
      <div className="p-1 text-center">
        <div className="text-sm">{dayCellInfo.dayNumberText}</div>
        <div className="text-xs text-gray-500 mt-1">잔여</div>
        <div className={`text-lg font-bold ${remainingColor}`}>{remaining}</div>
      </div>
    );
  };

  return (
    <AdminLayout>
      <h2 className="text-2xl font-bold mb-4">예약 시트 관리 (월간)</h2>
      
      {/* 조회용 달력 */}
      <div className="bg-white p-4 rounded-lg shadow-md mb-8">
        <FullCalendar
          plugins={[dayGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,dayGridWeek'
          }}
          events={events}
          dayCellContent={renderDayCell}
          datesSet={handleDatesSet} // 달력 날짜 범위가 변경될 때 호출
          locale="ko"
          height="auto"
        />
      </div>

      {/* ✅ 입력용 리스트 */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-xl font-bold mb-4">{currentMonth.getFullYear()}년 {currentMonth.getMonth() + 1}월 작업 가능 개수 설정</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          {currentMonthDates.map(dateStr => (
            <div key={dateStr} className="p-3 border rounded-lg">
              <label className="block text-sm font-semibold text-gray-700">{dateStr}</label>
              <input
                type="number"
                value={capacities[dateStr] || ''}
                onChange={(e) => handleCapacityChange(dateStr, e.target.value)}
                className="mt-2 w-full text-center border-gray-300 rounded-md p-1 shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="총량"
              />
            </div>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
}

export default withAdminAuth(AdminSchedule);