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
    const [capacities, setCapacities] = useState({});

    // Firestore 데이터 실시간 감지
    useEffect(() => {
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
            campaignUnsubscribe(); 
            capacityUnsubscribe(); 
        };
    }, []);

    // campaigns 데이터가 변경될 때만 FullCalendar 이벤트를 다시 계산
    const events = useMemo(() => {
        return campaigns.map(campaign => {
            const eventDate = campaign.date?.seconds 
                ? new Date(campaign.date.seconds * 1000) 
                : new Date(campaign.date);
            
            return {
                id: campaign.id,
                title: `예약 (${campaign.quantity || 0}개)`, // 판매자 페이지에서는 닉네임 없이 표시
                start: eventDate,
                allDay: true,
                extendedProps: { 
                    quantity: campaign.quantity || 0 
                }
            };
        });
    }, [campaigns]);
  
    // 달력의 각 날짜 셀 내용 렌더링
    const renderSellerDayCell = (dayCellInfo) => {
        const dateStr = formatDate(dayCellInfo.date);
        const capacity = capacities[dateStr] || 0;
        
        // FullCalendar가 전달하는 해당 날짜의 이벤트 목록을 사용 (더 효율적)
        const dailyEvents = Array.isArray(dayCellInfo.events) ? dayCellInfo.events : [];
        const totalQuantity = dailyEvents.reduce((sum, event) => sum + Number(event.extendedProps?.quantity || 0), 0);
        
        const remaining = capacity - totalQuantity;
        const remainingColor = remaining > 0 ? 'text-blue-600' : 'text-red-500';
        const remainingTextSize = remaining > 0 ? 'text-2xl' : 'text-lg';

        return (
            // 스크린샷과 유사한 레이아웃으로 수정
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
                        right: '' // 오른쪽 버튼 제거
                    }}
                    buttonText={{ today: 'today' }}
                    events={events}
                    dayCellContent={renderSellerDayCell}
                    dayCellClassNames="relative h-28" // 셀의 상대 위치 기준 및 높이 지정
                    locale="ko"
                    height="auto"
                    timeZone='local'
                    eventDisplay="list-item" // 이벤트를 리스트 아이템('•' 포함)처럼 표시
                    eventColor="#374151" // 이벤트 마커 색상 (회색)
                />
            </div>
        </SellerLayout>
    );
}

export default SellerHome;