import { useEffect, useState, useCallback } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import withAdminAuth from '../../hoc/withAdminAuth';
import { db } from '../../lib/firebase';
import { collection, onSnapshot, doc, setDoc } from 'firebase/firestore';

import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from "@fullcalendar/interaction";

const formatDate = (date) => date.toISOString().slice(0, 10);

// ✅ 입력 처리를 위한 별도의 컴포넌트 분리 (더 깔끔한 관리)
const CapacityInput = ({ dateStr, initialValue }) => {
  const [value, setValue] = useState(initialValue);

  // Firestore에 저장하는 함수 (useCallback으로 불필요한 재생성 방지)
  const updateFirestore = useCallback(async (numericValue) => {
    try {
      await setDoc(doc(db, 'capacities', dateStr), { capacity: numericValue });
    } catch (error) {
      console.error("Capacity 업데이트 오류:", error);
    }
  }, [dateStr]);

  // 입력 값이 변경될 때마다 state 업데이트
  const handleChange = (e) => {
    const numericValue = Number(e.target.value.replace(/[^0-9]/g, ''));
    setValue(numericValue);
  };
  
  // 입력 필드에서 포커스가 벗어날 때(onBlur) Firestore에 저장
  const handleBlur = () => {
    updateFirestore(value);
  };
  
  // 부모 컴포넌트에서 내려주는 초기값이 바뀔 때마다 내부 state도 업데이트
  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  return (
    <input
      type="number"
      value={value}
      onChange={handleChange}
      onBlur={handleBlur} // 포커스가 사라질 때 저장
      onClick={(e) => e.stopPropagation()}
      className="w-full text-center border rounded-sm p-0.5"
      placeholder="총량"
    />
  );
};


function AdminSchedule() {
  const [events, setEvents] = useState([]);
  const [capacities, setCapacities] = useState({});

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
          extendedProps: {
            quantity: data.quantity || 0
          }
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

  const renderDayCell = (dayCellInfo) => {
    const dateStr = formatDate(dayCellInfo.date);
    const capacity = capacities[dateStr] || 0;
    
    const totalQuantity = events
      .filter(e => formatDate(new Date(e.start)) === dateStr)
      .reduce((sum, e) => sum + Number(e.extendedProps.quantity || 0), 0);
      
    const remaining = capacity - totalQuantity;

    return (
      <div className="p-1 h-full flex flex-col">
        <div className="text-right text-sm">{dayCellInfo.dayNumberText}</div>
        <div className="flex-grow"></div>
        <div className="mt-auto text-xs">
          <div className="text-gray-500">잔여: {remaining}</div>
          {/* ✅ 분리된 입력 컴포넌트 사용 */}
          <CapacityInput dateStr={dateStr} initialValue={capacity} />
        </div>
      </div>
    );
  };


  return (
    <AdminLayout>
      <h2 className="text-2xl font-bold mb-4">예약 시트 관리 (월간)</h2>
      <div className="bg-white p-4 rounded-lg shadow-md">
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
          locale="ko"
          height="auto"
        />
      </div>
    </AdminLayout>
  );
}

export default withAdminAuth(AdminSchedule);