import { useEffect, useState, useMemo, useCallback } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import withAdminAuth from '../../hoc/withAdminAuth';
import { db } from '../../lib/firebase';
import { collection, onSnapshot, doc, setDoc } from 'firebase/firestore';

import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from "@fullcalendar/interaction";

const formatDateToKST = (date) => {
    // KST 보정 없이, JavaScript의 Date 객체를 YYYY-MM-DD 문자열로 변환
    // FullCalendar의 timeZone='local' 설정과 맞추기 위함
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// 입력 필드 컴포넌트
const CapacityInput = ({ dateStr, initialValue }) => {
    const [value, setValue] = useState(initialValue);

    const updateFirestore = useCallback(async (numericValue) => {
        try {
            await setDoc(doc(db, 'capacities', dateStr), { capacity: numericValue });
        } catch (error) {
            console.error("Capacity 업데이트 오류:", error);
        }
    }, [dateStr]);

    const handleChange = (e) => {
        setValue(e.target.value); // 문자열 그대로 state에 저장
    };
    
    const handleBlur = () => {
        const numericValue = Number(String(value).replace(/[^0-9]/g, ''));
        setValue(numericValue); // 숫자만 남겨서 state 업데이트
        updateFirestore(numericValue);
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
                const eventDate = data.date?.seconds ? new Date(data.date.seconds * 1000) : new Date(data.date);
                return {
                    id: d.id,
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

    const handleDatesSet = (dateInfo) => {
        setCurrentMonth(dateInfo.start);
    };

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

    const renderDayCell = (dayCellInfo) => {
        const dateStr = formatDate(dayCellInfo.date);
        const capacity = capacities[dateStr] || 0;
        
        // ✅ 방어 코드 강화: dayCellInfo.events 배열을 직접 순회하여 계산
        const totalQuantity = dayCellInfo.events.reduce((sum, event) => {
            // event.extendedProps가 존재하고, 그 안에 quantity가 있을 경우에만 더함
            const quantity = event.extendedProps?.quantity || 0;
            return sum + Number(quantity);
        }, 0);
        
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
                    headerToolbar={{
                        left: 'prev,next today',
                        center: 'title',
                        right: 'dayGridMonth,dayGridWeek'
                    }}
                    events={events}
                    dayCellContent={renderDayCell}
                    datesSet={handleDatesSet}
                    locale="ko"
                    height="auto"
                    timeZone='local'
                />
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md">
                <h3 className="text-xl font-bold mb-4">{currentMonth.getFullYear()}년 {currentMonth.getMonth() + 1}월 작업 가능 개수 설정</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                    {currentMonthDates.map(dateStr => (
                        <div key={dateStr} className="p-3 border rounded-lg">
                            <label className="block text-sm font-semibold text-gray-700">{dateStr}</label>
                            <CapacityInput dateStr={dateStr} initialValue={capacities[dateStr] || ''} />
                        </div>
                    ))}
                </div>
            </div>
        </AdminLayout>
    );
}

export default withAdminAuth(AdminSchedule);