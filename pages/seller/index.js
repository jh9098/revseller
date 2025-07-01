import { useEffect, useState, useMemo } from 'react';
import SellerLayout from '../../components/seller/SellerLayout';
import { db } from '../../lib/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import Link from 'next/link';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from "@fullcalendar/interaction";

// 날짜를 'YYYY-MM-DD' 형식의 문자열로 변환하는 함수
const formatDate = (date) => {
    if (!date || !(date instanceof Date)) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

function SellerHome() {
    // Firestore에서 가져온 원본 데이터를 저장하는 상태
    const [campaigns, setCampaigns] = useState([]);
    const [sellers, setSellers] = useState({}); // sellers 컬렉션 데이터 (id: nickname 맵)
    const [capacities, setCapacities] = useState({});

    // Firestore 데이터 실시간 감지
    useEffect(() => {
        // Sellers 컬렉션 감지 (판매자 닉네임 가져오기)
        const sellerUnsubscribe = onSnapshot(collection(db, 'sellers'), (snap) => {
            const fetchedSellers = {};
            snap.forEach(doc => {
                fetchedSellers[doc.id] = doc.data().nickname || '이름없음';
            });
            setSellers(fetchedSellers);
        });

        // Campaigns 컬렉션 감지
        const campaignUnsubscribe = onSnapshot(collection(db, 'campaigns'), (snap) => {
            const fetchedCampaigns = snap.docs.map(d => ({
                id: d.id,
                ...d.data()
            }));
            setCampaigns(fetchedCampaigns);
        });
        
        // Capacities 컬렉션 감지
        const capacityUnsubscribe = onSnapshot(collection(db, 'capacities'), (snap) => {
            const fetchedCaps = {};
            snap.forEach(doc => { 
                fetchedCaps[doc.id] = doc.data().capacity || 0; 
            });
            setCapacities(fetchedCaps);
        });

        // 컴포넌트 언마운트 시 리스너 정리
        return () => { 
            sellerUnsubscribe();
            campaignUnsubscribe(); 
            capacityUnsubscribe(); 
        };
    }, []);

    // campaigns 또는 sellers 데이터가 변경될 때만 FullCalendar 이벤트를 다시 계산
    const events = useMemo(() => {
        // sellers 데이터가 로드될 때까지 기다림
        if (Object.keys(sellers).length === 0) return [];

        return campaigns.map(campaign => {
            // sellerId로 닉네임 찾기
            const nickname = sellers[campaign.sellerId] || '판매자 없음';
            const quantity = campaign.quantity || 0;

            const eventDate = campaign.date?.seconds 
                ? new Date(campaign.date.seconds * 1000) 
                : new Date(campaign.date);
            
            return {
                id: campaign.id,
                title: `${nickname} (${quantity}개)`, // 요구사항에 맞게 '닉네임 (개수)'로 변경
                start: eventDate,
                allDay: true,
                extendedProps: { 
                    quantity: quantity 
                }
            };
        });
    }, [campaigns, sellers]); // sellers가 변경될 때도 이벤트를 다시 계산하도록 추가
  
    // 달력의 각 날짜 셀 내용 렌더링
    const renderSellerDayCell = (dayCellInfo) => {
        const dateStr = formatDate(dayCellInfo.date);
        const capacity = capacities[dateStr] || 0;
        
        // FullCalendar가 전달하는 해당 날짜의 이벤트 목록을 사용
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
                    headerToolbar={{
                        left: 'prev,next today',
                        center: 'title',
                        right: ''
                    }}
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