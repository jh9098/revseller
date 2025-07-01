import { useEffect, useState } from 'react';
import SellerLayout from '../../components/seller/SellerLayout';
import { db } from '../../lib/firebase';
import { collection, onSnapshot, doc, getDoc } from 'firebase/firestore';
import Link from 'next/link';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from "@fullcalendar/interaction";

// 날짜 포맷 함수
const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

function SellerHome() {
    const [events, setEvents] = useState([]);
    const [capacities, setCapacities] = useState({});

    useEffect(() => {
        const campaignUnsubscribe = onSnapshot(collection(db, 'campaigns'), async (snap) => {
            const fetchedEvents = await Promise.all(snap.docs.map(async (d) => {
                const data = d.data();
                const eventDate = data.date?.seconds ? new Date(data.date.seconds * 1000) : new Date(data.date);
                return {
                    id: d.id,
                    title: `예약 (${data.quantity || 0}개)`,
                    start: eventDate,
                    allDay: true,
                    extendedProps: { quantity: data.quantity || 0 }
                };
            }));
            setEvents(fetchedEvents);
        });
        const capacityUnsubscribe = onSnapshot(collection(db, 'capacities'), (snap) => {
            const fetchedCaps = {};
            snap.forEach(doc => { fetchedCaps[doc.id] = doc.data().capacity || 0; });
            setCapacities(fetchedCaps);
        });
        return () => { campaignUnsubscribe(); capacityUnsubscribe(); };
    }, []);
  
    const renderSellerDayCell = (dayCellInfo) => {
        const dateStr = formatDate(dayCellInfo.date);
        const capacity = capacities[dateStr] || 0;
        
        const dailyEvents = Array.isArray(dayCellInfo.events) ? dayCellInfo.events : [];
        const totalQuantity = dailyEvents.reduce((sum, event) => sum + Number(event.extendedProps?.quantity || 0), 0);
        
        const remaining = capacity - totalQuantity;

        return (
            <div className="p-1 text-center h-full flex flex-col justify-center">
                <div className="absolute top-1 right-1 text-sm">{dayCellInfo.dayNumberText}</div>
                <div className="mt-1 flex flex-col items-center">
                    <span className="text-xs text-gray-500">잔여</span>
                    {remaining > 0 ? (
                        <Link href={`/dashboard/products?date=${dateStr}`} legacyBehavior>
                            <a className="font-bold text-2xl text-blue-600 cursor-pointer hover:underline transition-all">
                                {remaining}
                            </a>
                        </Link>
                    ) : (
                        <span className="font-bold text-lg text-red-500">{remaining}</span>
                    )}
                </div>
            </div>
        );
    };

    return (
        <SellerLayout>
            <h2 className="text-2xl font-bold mb-4">예약 현황 (날짜 클릭 시 예약 가능)</h2>
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
                    timeZone='local'
                    eventDisplay="list-item" // 이벤트를 리스트 아이템처럼 간결하게 표시
                />
            </div>
        </SellerLayout>
    );
}

export default SellerHome;