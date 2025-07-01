import { useEffect, useState, useMemo } from 'react';
import SellerLayout from '../../components/seller/SellerLayout';
import { db } from '../../lib/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import Link from 'next/link';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from "@fullcalendar/interaction";

const formatDate = (date) => {
    if (!date || !(date instanceof Date)) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

function SellerHome() {
    const [campaigns, setCampaigns] = useState([]);
    const [sellers, setSellers] = useState({}); // { "사용자UID": "닉네임" } 형태의 맵
    const [capacities, setCapacities] = useState({});

    useEffect(() => {
        // Sellers 컬렉션에서 'uid'를 key로, 'nickname'을 value로 하는 맵을 생성
        const sellerUnsubscribe = onSnapshot(collection(db, 'sellers'), (snap) => {
            const fetchedSellers = {};
            snap.forEach(doc => {
                const data = doc.data();
                // ✅ sellers 문서의 uid 필드를 key로 사용
                if (data.uid) {
                    fetchedSellers[data.uid] = data.nickname || '이름없음';
                }
            });
            setSellers(fetchedSellers);
        });

        const campaignUnsubscribe = onSnapshot(collection(db, 'campaigns'), (snap) => {
            const fetchedCampaigns = snap.docs.map(d => ({
                id: d.id,
                ...d.data()
            }));
            setCampaigns(fetchedCampaigns);
        });
        
        const capacityUnsubscribe = onSnapshot(collection(db, 'capacities'), (snap) => {
            const fetchedCaps = {};
            snap.forEach(doc => { 
                fetchedCaps[doc.id] = doc.data().capacity || 0; 
            });
            setCapacities(fetchedCaps);
        });

        return () => { 
            sellerUnsubscribe();
            campaignUnsubscribe(); 
            capacityUnsubscribe(); 
        };
    }, []);

    const events = useMemo(() => {
        if (Object.keys(sellers).length === 0) return [];

        return campaigns.map(campaign => {
            // ✅ campaigns 문서의 sellerUid 필드를 사용하여 닉네임 조회
            const sellerUid = campaign.sellerUid;
            const nickname = sellers[sellerUid] || '판매자 없음';
            const quantity = campaign.quantity || 0;

            const eventDate = campaign.date?.seconds 
                ? new Date(campaign.date.seconds * 1000) 
                : new Date(campaign.date);
            
            return {
                id: campaign.id,
                title: `${nickname} (${quantity}개)`,
                start: eventDate,
                allDay: true,
                extendedProps: { 
                    quantity: quantity 
                }
            };
        });
    }, [campaigns, sellers]);
  
    const renderSellerDayCell = (dayCellInfo) => {
        const dateStr = formatDate(dayCellInfo.date);
        const capacity = capacities[dateStr] || 0;
        
        const dailyEvents = Array.isArray(dayCellInfo.events) ? dayCellInfo.events : [];
        const totalQuantity = dailyEvents.reduce((sum, event) => sum + Number(event.extendedProps?.quantity || 0), 0);
        
        const remaining = capacity - totalQuantity;
        const remainingColor = remaining > 0 ? 'text-blue-600' : 'text-red-500';
        const remainingTextSize = remaining > 0 ? 'text-2xl' : 'text-lg';

        return (
            <>
                <div className="absolute top-1 right-1 text-sm text-gray-600">{dayCellInfo.dayNumberText}</div>
                <div className="flex flex-col items-center justify-center h-full pt-2">
                    <div className="text-xs text-gray-500">잔여</div>
                    {remaining > 0 ? (
                        <Link href={`/dashboard/products?date=${dateStr}`} legacyBehavior>
                            <a className={`font-bold ${remainingTextSize} ${remainingColor} cursor-pointer hover:underline`}>
                                {remaining}
                            </a>
                        </Link>
                    ) : (
                        <span className={`font-bold ${remainingTextSize} ${remainingColor}`}>{remaining}</span>
                    )}
                </div>
            </>
        );
    };

    return (
        <SellerLayout>
            <h2 className="text-2xl font-bold mb-4">예약 현황 (날짜 클릭 시 예약 가능)</h2>
            <div className="bg-white p-4 rounded-lg shadow-md">
                <FullCalendar
                    plugins={[dayGridPlugin, interactionPlugin]}
                    initialView="dayGridMonth"
                    headerToolbar={{ left: 'prev,next today', center: 'title', right: '' }}
                    buttonText={{ today: 'today' }}
                    events={events}
                    dayCellContent={renderSellerDayCell}
                    dayCellClassNames="relative h-28" 
                    locale="ko"
                    height="auto"
                    timeZone='local'
                    eventDisplay="list-item" 
                    eventColor="#374151" 
                />
            </div>
        </SellerLayout>
    );
}

export default SellerHome;