import { useEffect, useState, useMemo } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import withAdminAuth from '../../hoc/withAdminAuth';
import { db } from '../../lib/firebase';
import { collection, onSnapshot, doc, setDoc } from 'firebase/firestore';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from "@fullcalendar/interaction";

// ✅ KST 시간 보정을 위한 헬퍼 함수
const KST_OFFSET = 9 * 60 * 60 * 1000; // 9시간을 밀리초로
const formatDateToKST = (date) => {
  const kstDate = new Date(date.getTime() + KST_OFFSET);
  return kstDate.toISOString().slice(0, 10);
};

const CapacityInput = ({ dateStr, initialValue }) => {
  // ... (이 컴포넌트는 수정할 필요 없음)
  const [value, setValue] = useState(initialValue);

  const updateFirestore = useCallback(async (numericValue) => {
    try {
      await setDoc(doc(db, 'capacities', dateStr), { capacity: numericValue });
    } catch (error) {
      console.error("Capacity 업데이트 오류:", error);
    }
  }, [dateStr]);

  const handleChange = (e) => {
    const numericValue = Number(e.target.value.replace(/[^0-9]/g, ''));
    setValue(numericValue);
  };
  
  const handleBlur = () => {
    updateFirestore(value);
  };
  
  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  return (
    <input
      type="number"
      value={value}
      onChange={handleChange}
      onBlur={handleBlur}
      onClick={(e) => e.stopPropagation()}
      className="w-full text-center border rounded-sm p-0.5"
      placeholder="총량"
    />
  );
};

function AdminSchedule() {
  const [events, setEvents] = useState([]);
  const [capacities, setCapacities] = useState({});
  const [currentMonth, setCurrentMonth] = useState(new Date());

  useEffect(() => {
    const campaignUnsubscribe = onSnapshot(collection(db, 'campaigns'), (snap) => {
      const fetchedEvents = snap.docs.map(d => {
        const data = d.data();
        // ✅ Firestore의 UTC 타임스탬프를 JavaScript Date 객체로 올바르게 변환
        const eventDate = data.date?.seconds ? new Date(data.date.seconds * 1000) : new Date(data.date);
        return {
          id: d.id,
          title: `${data.productName} (${data.quantity || 0}개)`,
          start: eventDate, // FullCalendar는 Date 객체를 그대로 사용
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
  
  const handleDatesSet = (dateInfo) => {
    setCurrentMonth(dateInfo.start);
  };

  const currentMonthDates = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const dates = [];
    for (let i = 1; i <= daysInMonth; i++) {
      // ✅ 날짜 생성 시 한국 기준 날짜로 명확하게 생성
      dates.push(formatDateToKST(new Date(Date.UTC(year, month, i))));
    }
    return dates;
  }, [currentMonth]);

  const handleCapacityChange = async (dateStr, value) => {
    // ... (수정할 필요 없음)
  };
  
  const renderDayCell = (dayCellInfo) => {
    // ✅ 달력 셀 렌더링 시에도 KST 기준 날짜 문자열 사용
    const dateStr = formatDateToKST(dayCellInfo.date);
    const capacity = capacities[dateStr] || 0;
    
    const totalQuantity = events
      // ✅ 이벤트 필터링 시에도 KST 기준 날짜 문자열로 비교
      .filter(e => formatDateToKST(new Date(e.start)) === dateStr)
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
      
      <div className="bg-white p-4 rounded-lg shadow-md mb-8">
        <FullCalendar
          plugins={[dayGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,dayGridWeek' }}
          events={events}
          dayCellContent={renderDayCell}
          datesSet={handleDatesSet}
          locale="ko"
          height="auto"
          // ✅ FullCalendar가 날짜를 해석하는 기준을 로컬(브라우저) 시간대로 명시
          timeZone='local'
        />
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-xl font-bold mb-4">{currentMonth.getFullYear()}년 {currentMonth.getMonth() + 1}월 작업 가능 개수 설정</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          {currentMonthDates.map(dateStr => (
            <div key={dateStr} className="p-3 border rounded-lg">
              <label className="block text-sm font-semibold text-gray-700">{dateStr}</label>
              <CapacityInput dateStr={dateStr} initialValue={capacities[dateStr] || 0} />
            </div>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
}

export default withAdminAuth(AdminSchedule);