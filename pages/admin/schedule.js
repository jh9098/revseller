import { useEffect, useState, useMemo, useCallback } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import withAdminAuth from '../../hoc/withAdminAuth';
import { db } from '../../lib/firebase';
import { collection, onSnapshot, doc, setDoc, getDocs } from 'firebase/firestore';

import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from "@fullcalendar/interaction";

// 날짜를 'YYYY-MM-DD' 형식의 문자열로 변환하는 함수
const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// 각 날짜별 최대 가능 개수 입력을 위한 컴포넌트
const CapacityInput = ({ dateStr, initialValue }) => {
    const [value, setValue] = useState(initialValue);

    // Firestore에 변경된 capacity 값을 업데이트하는 함수
    const updateFirestore = useCallback(async (numericValue) => {
        try {
            await setDoc(doc(db, 'capacities', dateStr), { capacity: numericValue });
        } catch (error) {
            console.error("Capacity 업데이트 오류:", error);
        }
    }, [dateStr]);

    const handleChange = (e) => { setValue(e.target.value); };
    
    // input 포커스가 해제될 때 숫자만 남기고 Firestore에 업데이트
    const handleBlur = () => {
        const numericValue = Number(String(value).replace(/[^0-9]/g, '')) || 0; // 숫자가 아니면 0으로 처리
        setValue(numericValue);
        updateFirestore(numericValue);
    };

    useEffect(() => { setValue(initialValue); }, [initialValue]);

    return (
        <input type="number" value={value} onChange={handleChange} onBlur={handleBlur} onClick={(e) => e.stopPropagation()}
            className="w-full text-center border rounded-sm p-0.5" placeholder="총량" />
    );
};

// 메인 관리자 스케줄 컴포넌트
function AdminSchedule() {
    const [campaigns, setCampaigns] = useState([]);
    const [sellers, setSellers] = useState({}); // { "사용자UID": "닉네임" } 형태의 맵
    const [capacities, setCapacities] = useState({});
    const [currentMonth, setCurrentMonth] = useState(new Date());

    useEffect(() => {
        // ✅ sellers 문서의 uid 필드를 key로 사용하여 맵 생성
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

    // 달력의 월이 변경될 때 호출되어 현재 월 정보를 업데이트
    const handleDatesSet = (dateInfo) => {
        setCurrentMonth(dateInfo.view.currentStart);
    };

    // 현재 월의 모든 날짜 배열 생성 (하단 Capacity 설정용)
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

    // 달력의 각 날짜 셀 내용 렌더링
    const renderDayCell = (dayCellInfo) => {
        const dateStr = formatDate(dayCellInfo.date);
        const capacity = capacities[dateStr] || 0;

        // 해당 날짜의 이벤트만 필터링
        const dailyEvents = events.filter(event => formatDate(new Date(event.start)) === dateStr);
        
        // 해당 날짜의 총 quantity 합계 계산
        const totalQuantity = dailyEvents.reduce((sum, event) => sum + Number(event.extendedProps?.quantity || 0), 0);
        
        // 잔여량 계산
        const remaining = capacity - totalQuantity;
        const remainingColor = remaining >= 0 ? 'text-blue-600' : 'text-red-600';

        return (
            <div className="p-1 text-center">
                {/* 날짜 표시 - FullCalendar 기본값 사용을 위해 dayNumberText 사용 */}
                <div className="fc-daygrid-day-number">{dayCellInfo.dayNumberText.replace('일', '')}</div>
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
                        right: 'month,week' // month, week 으로 버튼 텍스트 변경
                    }}
                    events={events}
                    // dayCellContent 대신 dayCellDidMount 사용 (잔여량 계산에 events가 필요하기 때문)
                    // 하지만 현재 구조에서는 events가 dayCellInfo에 직접 전달되지 않으므로, renderDayCell에서 events 상태를 직접 참조하는 것이 더 효율적입니다.
                    // dayCellContent에서 FullCalendar가 전달하는 events는 해당 셀의 이벤트'만'을 포함하지 않을 수 있어, 직접 필터링하는 것이 안전합니다.
                    dayCellContent={renderDayCell}
                    datesSet={handleDatesSet}
                    locale="ko"
                    height="auto"
                    timeZone='local'
                    // 버튼 텍스트를 소문자로 변경
                    buttonText={{
                        today: 'today',
                        month: 'month',
                        week: 'week'
                    }}
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