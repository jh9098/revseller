import { useEffect, useState, useMemo } from 'react';
import SellerLayout from '../../components/seller/SellerLayout';
import { db } from '../../lib/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import Link from 'next/link';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from "@fullcalendar/interaction";

// 날짜를 'YYYY-MM-DD' 형식의 문자열로 변환하는 헬퍼 함수
const formatDate = (date) => {
    if (!date || !(date instanceof Date)) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

function SellerHome() {
    const [campaigns, setCampaigns] = useState([]);
    const [sellers, setSellers] = useState({});
    const [capacities, setCapacities] = useState({});

    useEffect(() => {
        // 'sellers' 컬렉션에서 판매자 정보(uid: nickname)를 실시간으로 가져옵니다.
        const sellerUnsubscribe = onSnapshot(collection(db, 'sellers'), (snap) => {
            const fetchedSellers = {};
            snap.forEach(doc => {
                const data = doc.data();
                if (data.uid) {
                    fetchedSellers[data.uid] = data.nickname || '이름없음';
                }
            });
            setSellers(fetchedSellers);
        });

        // 'campaigns' 컬렉션에서 모든 예약 정보를 실시간으로 가져옵니다.
        const campaignUnsubscribe = onSnapshot(collection(db, 'campaigns'), (snap) => {
            const fetchedCampaigns = snap.docs.map(d => ({
                id: d.id,
                ...d.data()
            }));
            setCampaigns(fetchedCampaigns);
        });
        
        // 'capacities' 컬렉션에서 날짜별 잔여 수량 정보를 실시간으로 가져옵니다.
        const capacityUnsubscribe = onSnapshot(collection(db, 'capacities'), (snap) => {
            const fetchedCaps = {};
            snap.forEach(doc => { 
                fetchedCaps[doc.id] = doc.data().capacity || 0; 
            });
            setCapacities(fetchedCaps);
        });

        // 컴포넌트가 언마운트될 때 Firestore 리스너를 정리합니다.
        return () => { 
            sellerUnsubscribe();
            campaignUnsubscribe(); 
            capacityUnsubscribe(); 
        };
    }, []);

    // ✅ [핵심 수정 부분] campaigns 데이터를 그룹화하여 events 배열을 생성합니다.
    const events = useMemo(() => {
        if (Object.keys(sellers).length === 0 || campaigns.length === 0) return [];

        // 1. 날짜와 닉네임별로 수량을 합산하기 위한 중간 데이터 구조
        // ex: { '2025-07-01': { '꿀꿀이': 1, '바르르': 211 }, ... }
        const dailyAggregates = {};

        campaigns.forEach(campaign => {
            const eventDate = campaign.date?.seconds 
                ? new Date(campaign.date.seconds * 1000) 
                : new Date(campaign.date);
            
            const dateStr = formatDate(eventDate);
            if (!dateStr) return; // 유효하지 않은 날짜는 건너뜁니다.

            const nickname = sellers[campaign.sellerUid] || '판매자 없음';
            const quantity = Number(campaign.quantity) || 0;

            // 해당 날짜의 집계 객체가 없으면 생성합니다.
            if (!dailyAggregates[dateStr]) {
                dailyAggregates[dateStr] = {};
            }
            // 해당 날짜, 해당 닉네임의 수량을 합산합니다.
            if (!dailyAggregates[dateStr][nickname]) {
                dailyAggregates[dateStr][nickname] = 0;
            }
            dailyAggregates[dateStr][nickname] += quantity;
        });

        // 2. 집계된 데이터를 FullCalendar 이벤트 형식으로 변환합니다.
        const aggregatedEvents = [];
        for (const dateStr in dailyAggregates) {
            const nicknamesForDay = dailyAggregates[dateStr];
            for (const nickname in nicknamesForDay) {
                const totalQuantity = nicknamesForDay[nickname];

                if (totalQuantity > 0) {
                    aggregatedEvents.push({
                        id: `${dateStr}-${nickname}`, // 고유 ID 생성
                        title: `${nickname} (${totalQuantity}개)`,
                        start: dateStr, // 날짜 문자열을 그대로 사용
                        allDay: true,
                        extendedProps: {
                            quantity: totalQuantity 
                        }
                    });
                }
            }
        }
        
        return aggregatedEvents;
    }, [campaigns, sellers]);
  
    // 달력의 각 날짜 셀 내용 렌더링 (잔여 수량 표시)
    const renderSellerDayCell = (dayCellInfo) => {
        const dateStr = formatDate(dayCellInfo.date);
        const capacity = capacities[dateStr] || 0;
        
        const dailyEvents = events.filter(event => 
            formatDate(new Date(event.start)) === dateStr
        );
        
        const totalQuantity = dailyEvents.reduce((sum, event) => {
            const quantity = Number(event.extendedProps?.quantity || 0);
            return sum + quantity;
        }, 0);
        
        const remaining = capacity - totalQuantity;
        const remainingColor = remaining > 0 ? 'text-blue-600' : 'text-red-500';
        // 폰트 크기를 약간 조절하여 레이아웃이 깨지지 않도록 합니다.
        const remainingTextSize = 'text-xl'; 

        return (
            // 전체 셀을 Flexbox 컨테이너로 만듭니다. (세로 정렬)
            <div className="flex flex-col h-full">
                {/* 1. 날짜: 오른쪽 상단에 배치 */}
                <div className="text-right text-sm text-gray-500 pr-1 pt-1">
                    {dayCellInfo.dayNumberText}일
                </div>

                {/* 2. 잔여 수량: 남은 공간을 차지하며 중앙에 정렬 (flex-grow) */}
                <div className="flex flex-col items-center justify-center flex-grow pb-2">
                    <div className="text-xs text-gray-500">잔여</div>
                    {remaining > 0 && capacity > 0 ? (
                        <Link href={`/dashboard/products?date=${dateStr}`} legacyBehavior>
                            <a className={`font-bold ${remainingTextSize} ${remainingColor} cursor-pointer hover:underline`}>
                                {remaining}
                            </a>
                        </Link>
                    ) : (
                        <span className={`font-bold ${remainingTextSize} ${remainingColor}`}>{remaining}</span>
                    )}
                </div>
            </div>
        );
    };

    return (
        <SellerLayout>
            <h2 className="text-2xl font-bold mb-4">체험단 예약 현황 (날짜 클릭 시 예약 가능)</h2>
            <div className="bg-white p-4 rounded-lg shadow-md">
                <FullCalendar
                    plugins={[dayGridPlugin, interactionPlugin]}
                    initialView="dayGridMonth"
                    headerToolbar={{ left: 'prev,next today', center: 'title', right: '' }}
                    buttonText={{ today: 'today' }}
                    events={events}
                    dayCellContent={renderSellerDayCell} // 수정된 렌더링 함수를 연결
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
