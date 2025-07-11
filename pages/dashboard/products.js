import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import { db, auth } from '../../lib/firebase';
import { collection, serverTimestamp, query, where, onSnapshot, writeBatch, doc, increment, updateDoc } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { signOut } from 'firebase/auth';
import SellerLayout from '../../components/seller/SellerLayout';
import { nanoid } from 'nanoid';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from "@fullcalendar/interaction";

// --- 가격 계산 함수 (기존과 동일) ---
const getBasePrice = (deliveryType, reviewType) => {
    if (deliveryType === '실배송') {
        switch (reviewType) {
            case '별점': return 1600;
            case '텍스트': return 1700;
            case '포토': return 1800;
            case '프리미엄(포토)': return 4000;
            case '프리미엄(영상)': return 5000;
            default: return 0;
        }
    } else if (deliveryType === '빈박스') {
        switch (reviewType) {
            case '별점': case '텍스트': return 5400;
            default: return 0;
        }
    }
    return 0;
};

// --- 초기 폼 상태 (기존과 동일) ---
const initialFormState = {
    date: new Date(), deliveryType: '실배송', reviewType: '별점', quantity: 1, productName: '',
    productOption: '', productPrice: 0, productUrl: '', keywords: '', reviewGuide: '', remarks: ''
};

// 날짜를 YYYY-MM-DD 형식으로 변환
const formatDate = (date) => {
    if (!date || !(date instanceof Date)) return '';
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

// YYYY-MM-DD(요일) 형식으로 변환
const formatDateWithDay = (date) => {
    if (!date || !(date instanceof Date)) return '';
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    return `${formatDate(date)}(${days[date.getDay()]})`;
};

export default function DashboardPage() {
    const [user, loading] = useAuthState(auth);
    const router = useRouter();

    // --- 상태 관리 ---
    const [formState, setFormState] = useState(initialFormState);
    const [campaigns, setCampaigns] = useState([]);
    const [totalAmount, setTotalAmount] = useState(0);
  const [savedCampaigns, setSavedCampaigns] = useState([]);
    const [isLoadingDB, setIsLoadingDB] = useState(true);
    const [deposit, setDeposit] = useState(0);
    const [useDeposit, setUseDeposit] = useState(false);

    const [nickname, setNickname] = useState('');
    const [calendarCampaigns, setCalendarCampaigns] = useState([]);
    const [sellersMap, setSellersMap] = useState({});
    const [capacities, setCapacities] = useState({});
    const [showDepositPopup, setShowDepositPopup] = useState(false);
    const [confirmCampaign, setConfirmCampaign] = useState(null);

    const [quoteTotal, setQuoteTotal] = useState(0); // 수수료 미포함 견적 합계
    
    
    // ✅ [추가] 단가표 모달의 열림/닫힘 상태를 관리합니다.
const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);

    // 예약 현황 캘린더용 이벤트 생성
    const calendarEvents = useMemo(() => {
        if (Object.keys(sellersMap).length === 0 || calendarCampaigns.length === 0) return [];
        const dailyAggregates = {};
        calendarCampaigns.filter(c => c.status === '예약 확정').forEach(c => {
            const d = c.date?.seconds ? new Date(c.date.seconds * 1000) : new Date(c.date);
            const dateStr = formatDate(d);
            if (!dateStr) return;
            const nickname = sellersMap[c.sellerUid] || '판매자';
            const qty = Number(c.quantity) || 0;
            if (!dailyAggregates[dateStr]) dailyAggregates[dateStr] = {};
            if (!dailyAggregates[dateStr][nickname]) dailyAggregates[dateStr][nickname] = 0;
            dailyAggregates[dateStr][nickname] += qty;
        });

        const events = [];
        for (const dateStr in dailyAggregates) {
            const nickMap = dailyAggregates[dateStr];
            for (const nick in nickMap) {
                const qty = nickMap[nick];
                events.push({ id: `${dateStr}-${nick}`, title: `${nick} (${qty}개)`, start: dateStr, allDay: true, extendedProps: { quantity: qty } });
            }
        }
        return events;
    }, [calendarCampaigns, sellersMap]);

    const renderDayCell = (info) => {
        const dateStr = formatDate(info.date);
        const capacity = capacities[dateStr] || 0;
        const dayEvents = calendarEvents.filter(e => formatDate(new Date(e.start)) === dateStr);
        const totalQty = dayEvents.reduce((s,e)=>s+Number(e.extendedProps?.quantity||0),0);
        const remaining = capacity - totalQty;
        const color = remaining > 0 ? 'text-blue-600' : 'text-red-500';
        return (
            <div className="flex flex-col h-full">
                <div className="text-right text-xs text-gray-500 pr-1 pt-1">{info.dayNumberText}일</div>
                <div className="flex-grow flex flex-col items-center justify-center pb-1">
                    <div className="text-[10px] text-gray-500">잔여</div>
                    <span className={`text-xs font-bold ${color}`}>{remaining}</span>
                </div>
            </div>
        );
    };

    // --- 계산 로직 ---
    const basePrice = getBasePrice(formState.deliveryType, formState.reviewType);
    const sundayExtraCharge = formState.date.getDay() === 0 ? 600 : 0;
    const finalUnitPrice = basePrice + sundayExtraCharge;
    const amountToUseFromDeposit = useDeposit ? Math.min(totalAmount, deposit) : 0;
    const remainingPayment = totalAmount - amountToUseFromDeposit;
    const totalCommission = totalAmount - quoteTotal;

    // --- useEffect 훅 (기존 로직과 동일) ---
    useEffect(() => {
        if (router.isReady) {
            const { date } = router.query;
            if (date && typeof date === 'string') {
                const parts = date.split('-').map(part => parseInt(part, 10));
                const selectedDate = new Date(parts[0], parts[1] - 1, parts[2]);
                setFormState(prev => ({ ...prev, date: selectedDate }));
            }
        }
    }, [router.isReady, router.query]);

    useEffect(() => {
        if (formState.deliveryType === '빈박스' && !['별점', '텍스트'].includes(formState.reviewType)) {
            setFormState(prev => ({ ...prev, reviewType: '별점' }));
        }
    }, [formState.deliveryType, formState.reviewType]);

    useEffect(() => {
        const currentQuoteTotal = campaigns.reduce((sum, campaign) => sum + campaign.itemTotal, 0);
        
        // 항목별로 수수료를 계산하고 합산하여 총액과의 오차를 없앱니다.
        const currentTotalAmount = campaigns.reduce((sum, campaign) => {
            return sum + Math.round(campaign.itemTotal * 1.10);
        }, 0);

        setQuoteTotal(currentQuoteTotal);
        setTotalAmount(currentTotalAmount);
    }, [campaigns]);

    useEffect(() => {
        if (loading) return;
        if (!user) {
            router.push('/');
            return;
        }
        
        const q = query(collection(db, "campaigns"), where("sellerUid", "==", user.uid));
        const unsubscribeCampaigns = onSnapshot(q, (snapshot) => {
            setSavedCampaigns(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setIsLoadingDB(false);
        });

        const sellerDocRef = doc(db, 'sellers', user.uid);
        const unsubscribeSeller = onSnapshot(sellerDocRef, (doc) => {
            if (doc.exists()) {
                const data = doc.data();
                setDeposit(data.deposit || 0);
                setNickname(data.nickname || user.email);
            }
        });

        // 전체 예약 현황 데이터 가져오기
        const unsubAllSellers = onSnapshot(collection(db, 'sellers'), (snap) => {
            const map = {};
            snap.forEach(d => { const data = d.data(); if (data.uid) map[data.uid] = data.nickname || '이름없음'; });
            setSellersMap(map);
        });
        const unsubAllCampaigns = onSnapshot(collection(db, 'campaigns'), (snap) => {
            setCalendarCampaigns(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        const unsubCaps = onSnapshot(collection(db, 'capacities'), (snap) => {
            const caps = {}; snap.forEach(d => { caps[d.id] = d.data().capacity || 0; });
            setCapacities(caps);
        });

        return () => {
            unsubscribeCampaigns();
            unsubscribeSeller();
            unsubAllSellers();
            unsubAllCampaigns();
            unsubCaps();
        };
    }, [user, loading, router]);

    // --- 핸들러 함수 (기존 로직과 동일) ---
    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setFormState(prev => ({ ...prev, [name]: value }));
    };

    const handleAddCampaign = (e) => {
        e.preventDefault();
        const itemTotal = (finalUnitPrice + Number(formState.productPrice)) * Number(formState.quantity);
        const newCampaign = { id: nanoid(), ...formState, basePrice, sundayExtraCharge, finalUnitPrice, itemTotal };
        setCampaigns([...campaigns, newCampaign]);
        setFormState(initialFormState);
    };

    const handleDeleteCampaign = (id) => {
        setCampaigns(campaigns.filter(c => c.id !== id));
    };

    const handleLogout = async () => {
        await signOut(auth);
        router.push('/');
    };

    const handleProcessPayment = async () => {
        if (campaigns.length === 0 || !user) {
            alert('결제할 견적 항목이 없습니다.');
            return;
        }

        const batch = writeBatch(db);
        const sellerDocRef = doc(db, 'sellers', user.uid);

        campaigns.forEach(campaign => {
            const { id, ...campaignData } = campaign;
            const campaignRef = doc(collection(db, 'campaigns'));
            batch.set(campaignRef, {
                ...campaignData,
                sellerUid: user.uid,
                createdAt: serverTimestamp(),
                status: '미확정',
                paymentReceived: false
            });
        });

        if (useDeposit && amountToUseFromDeposit > 0) {
            batch.update(sellerDocRef, {
                deposit: increment(-amountToUseFromDeposit)
            });
        }

        try {
            await batch.commit();
            setShowDepositPopup(true);
            setCampaigns([]);
            setUseDeposit(false);
        } catch (error) {
            console.error('결제 처리 중 오류 발생:', error);
            alert('결제 처리 중 오류가 발생했습니다.');
        }
    };

    const handleDepositChange = async (id, checked) => {
        try {
            await updateDoc(doc(db, 'campaigns', id), { paymentReceived: checked });
        } catch (err) {
            console.error('입금 여부 업데이트 오류:', err);
        }
    };

    const handleConfirmReservation = async () => {
        if (!confirmCampaign) return;
        try {
            await updateDoc(doc(db, 'campaigns', confirmCampaign.id), {
                status: '예약 확정',
                confirmedAt: serverTimestamp()
            });
        } catch (err) {
            console.error('예약 확정 오류:', err);
        }
        setConfirmCampaign(null);
    };
    
    // --- 렌더링 ---
    if (loading || isLoadingDB) return <p>로딩 중...</p>;
    if (!user) return null;

    const thClass = "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider";
    const tdClass = "px-4 py-3 whitespace-nowrap text-sm text-gray-800";
    const labelClass = "block text-sm font-medium text-gray-700 mb-1";
    const inputClass = "w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500";

    return (
        <SellerLayout>
            <div className="p-4 md:p-8 bg-gray-50 min-h-screen">
                {/* 헤더 부분 */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
                    <h1 className="text-3xl font-bold text-gray-800">리뷰 캠페인 대시보드</h1>
                    <div className="mt-4 sm:mt-0 flex items-center">
                        <span className="mr-4 text-gray-600">
                            <strong>예치금:</strong> <span className="font-bold text-blue-600">{deposit.toLocaleString()}원</span>
                        </span>
                        <span className="mr-4 text-gray-600">{nickname}</span>
                        <button onClick={handleLogout} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg">
                            로그아웃
                        </button>
                    </div>
                </div>

                {/* 새 작업 추가 폼 */}
                <form onSubmit={handleAddCampaign} className="p-6 bg-white rounded-xl shadow-lg mb-8">
                    <h2 className="text-2xl font-bold mb-6 text-gray-700">새 작업 추가</h2>
                    <div className="grid lg:grid-cols-3 gap-6">
                        <div>
                            <label className={labelClass}>진행 일자</label>
                            <DatePicker selected={formState.date} onChange={(date) => setFormState(p => ({ ...p, date }))} className={inputClass} />
                            <div className="mt-4 text-xs">
                                <FullCalendar
                                    plugins={[dayGridPlugin, interactionPlugin]}
                                    initialView="dayGridMonth"
                                    headerToolbar={{ left: 'prev,next', center: 'title', right: '' }}
                                    events={calendarEvents}
                                    dayCellContent={renderDayCell}
                                    dayCellClassNames="h-20"
                                    locale="ko"
                                    height={250}
                                />
                            </div>
                        </div>
                        <div className="space-y-4">
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className={labelClass}>구분</label>
                                    <select name="deliveryType" value={formState.deliveryType} onChange={handleFormChange} className={inputClass}>
                                        <option value="실배송">실배송</option>
                                        <option value="빈박스">빈박스</option>
                                    </select>
                                </div>
                                <div>
                                    <label className={labelClass}>리뷰 종류</label>
                                    <select name="reviewType" value={formState.reviewType} onChange={handleFormChange} className={inputClass}>
                                        {formState.deliveryType === '실배송' ? (
                                            <> <option>별점</option><option>텍스트</option><option>포토</option><option>프리미엄(포토)</option><option>프리미엄(영상)</option> </>
                                        ) : (
                                            <> <option>별점</option><option>텍스트</option> </>
                                        )}
                                    </select>
                                </div>
                                <div>
                                    <label className={labelClass}>체험단 개수</label>
                                    <input type="number" name="quantity" value={formState.quantity} onChange={handleFormChange} className={inputClass} min="1" required />
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className={labelClass}>상품명</label>
                                    <input type="text" name="productName" value={formState.productName} onChange={handleFormChange} className={inputClass} required />
                                </div>
                                <div>
                                    <label className={labelClass}>상품가</label>
                                    <input type="number" name="productPrice" value={formState.productPrice} onChange={handleFormChange} className={inputClass} placeholder="0" />
                                </div>
                                <div>
                                    <label className={labelClass}>옵션</label>
                                    <input type="text" name="productOption" value={formState.productOption} onChange={handleFormChange} className={inputClass} />
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className={labelClass}>키워드</label>
                                    <input type="text" name="keywords" value={formState.keywords} onChange={handleFormChange} className={inputClass} placeholder="1개만 입력" />
                                </div>
                                <div className="col-span-2">
                                    <label className={labelClass}>상품 URL</label>
                                    <input type="url" name="productUrl" value={formState.productUrl} onChange={handleFormChange} className={inputClass} placeholder="https://..." />
                                </div>
                            </div>
                            <div className="flex justify-end">
                                <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg shadow-md">견적에 추가</button>
                            </div>
                        </div>
                        <div>
                            <label className={labelClass}>리뷰 가이드</label>
                            <textarea name="reviewGuide" value={formState.reviewGuide} onChange={handleFormChange} disabled={formState.reviewType === '별점'} className={inputClass + ' h-48'} />
                        </div>
                    </div>

                    {/* ✅ [수정] 단가 표시 영역 */}
                    <div className="mt-6 p-4 border-t border-gray-200 flex justify-end items-center space-x-6 flex-wrap">
                        <div className="flex items-center">
                            <span className="text-sm text-gray-500">{`${formState.deliveryType}/${formState.reviewType} 단가:`}</span>
                            <span className="ml-2 font-semibold">{basePrice.toLocaleString()}원</span>
                            <button 
                                type="button" 
                                onClick={() => setIsPriceModalOpen(true)}
                                className="ml-4 text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-1 px-2 rounded"
                            >
                                단가표 보기
                            </button>
                        </div>
                        <span className="text-gray-400">+</span>
                        <div><span className="text-sm text-gray-500">공휴일 가산금:</span><span className={`ml-2 font-semibold ${sundayExtraCharge > 0 ? 'text-red-500' : ''}`}>{sundayExtraCharge.toLocaleString()}원</span></div>
                        <span className="text-gray-400">=</span>
                        <div><span className="text-sm text-gray-500">최종 개당 단가:</span><span className="ml-2 font-bold text-lg text-blue-600">{finalUnitPrice.toLocaleString()}원</span></div>
                    </div>
                </form>

                {/* 견적 목록 테이블 */}
                <div className="p-6 bg-white rounded-xl shadow-lg">
                    <h2 className="text-2xl font-bold mb-4 text-gray-700">견적 목록 (스프레드시트)</h2>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            {/* 테이블 내용 (기존과 동일) */}
                            <thead className="bg-gray-100"><tr>{['순번', '진행일자', '리뷰 종류', '상품명', '상품가', '작업개수', '견적 상세', '총 견적', '작업'].map(h => <th key={h} className={thClass}>{h}</th>)}</tr></thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                            {campaigns.length === 0 ? (
                                    <tr><td colSpan="9" className="text-center py-10 text-gray-500">위에서 작업을 추가해주세요.</td></tr>
                                ) : (
                                    campaigns.map((c, index) => {
                                        // ✅ [추가] 항목별 최종 결제액 및 수수료 계산
                                        const finalItemAmount = Math.round(c.itemTotal * 1.10);
                                        const commission = finalItemAmount - c.itemTotal;

                                        return (
                                            <tr key={c.id}>
                                                <td className={tdClass}>{index + 1}</td>
                                                <td className={tdClass}><span className={c.date.getDay() === 0 ? 'text-red-500 font-bold' : ''}>{formatDateWithDay(new Date(c.date))}</span></td>
                                                <td className={tdClass}>{c.deliveryType}/{c.reviewType}</td>
                                                <td className={tdClass}>{c.productName}</td>
                                                <td className={tdClass}>{Number(c.productPrice).toLocaleString()}원</td>
                                                <td className={tdClass}>{c.quantity}</td>
                                                {/* ✅ [수정] 견적 상세 표시 */}
                                                <td className={tdClass + " text-xs text-gray-500"}>
                                                    ((리뷰 {c.basePrice.toLocaleString()}
                                                    {c.sundayExtraCharge > 0 ? ` + 공휴일 ${c.sundayExtraCharge.toLocaleString()}` : ''}
                                                    ) + 상품가 {Number(c.productPrice).toLocaleString()}) * {c.quantity}개
                                                </td>
                                                {/* ✅ [수정] 총 견적 표시 */}
                                                <td className={tdClass}>
                                                    <div className='font-bold'>{finalItemAmount.toLocaleString()}원</div>
                                                    <div className='text-xs text-gray-500'>(견적 {c.itemTotal.toLocaleString()} + 수수료 {commission.toLocaleString()})</div>
                                                </td>
                                                <td className={tdClass}><button onClick={() => handleDeleteCampaign(c.id)} className="text-red-600 hover:text-red-800 font-semibold">삭제</button></td>
                                            </tr>
                                        )
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* ✅ [수정] 최종 결제 금액 및 예치금 사용 UI */}
                    <div className="mt-6 pt-6 border-t border-gray-200 text-right">
                        <div className="space-y-2 mb-4 text-gray-700">
                             <p className="text-md">
                                견적 합계: <span className="font-semibold">{quoteTotal.toLocaleString()}</span> 원
                            </p>
                            <p className="text-md">
                                세금계산서 (10%): <span className="font-semibold">{totalCommission.toLocaleString()}</span> 원
                            </p>
                            <p className="text-lg font-bold">
                                총 결제 금액: <span className="font-bold text-blue-600">{totalAmount.toLocaleString()}</span> 원
                            </p>
                            <hr className="my-3"/>
                            <div className="flex justify-end items-center text-lg">
                                <label htmlFor="use-deposit" className="mr-2">예치금 사용:</label>
                                <input type="checkbox" id="use-deposit" checked={useDeposit} onChange={(e) => setUseDeposit(e.target.checked)} disabled={deposit === 0 || totalAmount === 0} className="h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50"/>
                                <span className={`ml-2 text-red-500 font-semibold ${!useDeposit && 'opacity-50'}`}>- {amountToUseFromDeposit.toLocaleString()} 원</span>
                            </div>
                            <hr className="my-3"/>
                            <p className="text-gray-800">
                                최종 결제 금액:
                                <span className="font-bold text-3xl text-green-600 ml-4">
                                    {remainingPayment.toLocaleString()}
                                </span> 원
                            </p>
                        </div>
                        <button onClick={handleProcessPayment} disabled={campaigns.length === 0}
                            className="mt-4 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-lg text-lg shadow-lg disabled:bg-gray-400 disabled:cursor-not-allowed">
                            입금하기
                        </button>
                    </div>
                </div>
                
                {/* 나의 예약 내역 테이블 */}
                <div className="mt-8 p-6 bg-white rounded-xl shadow-lg">
                    <h2 className="text-2xl font-bold mb-4 text-gray-700">나의 예약 내역 (DB 저장 완료)</h2>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-100">
                                <tr>
                                    <th className={thClass}>진행일자</th>
                                    <th className={thClass} title="입금을 완료하셨으면 체크박스를 클릭해 주세요">입금여부*</th>
                                    <th className={thClass}>결제상태</th>
                                    <th className={thClass}>진행상태</th>
                                    <th className={thClass}>상품명</th>
                                    <th className={thClass}>리뷰 종류</th>
                                    <th className={thClass}>총 견적</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {savedCampaigns.length === 0 ? (
                                    <tr><td colSpan="7" className="text-center py-10 text-gray-500">예약 내역이 없습니다.</td></tr>
                                ) : (
                                    savedCampaigns.map(c => (
                                        <tr key={c.id}>
                                            <td className={tdClass}>{c.date?.seconds ? formatDateWithDay(new Date(c.date.seconds * 1000)) : '-'}</td>
                                            <td className={tdClass}>
                                                <input
                                                    type="checkbox"
                                                    checked={!!c.paymentReceived}
                                                    onChange={(e) => handleDepositChange(c.id, e.target.checked)}
                                                    title="입금을 완료하셨으면 체크박스를 클릭해 주세요"
                                                />
                                            </td>
                                            <td className={tdClass}>{c.paymentReceived ? '입금완료' : '입금전'}</td>
                                            <td className={tdClass}>
                                                {c.paymentReceived ? (
                                                    c.status === '예약 확정' ? (
                                                        <span>예약확정</span>
                                                    ) : (
                                                        <button onClick={() => setConfirmCampaign(c)} className="text-blue-600 underline">예약확정</button>
                                                    )
                                                ) : '예약중'}
                                            </td>
                                            <td className={tdClass}>{c.productName}</td>
                                            <td className={tdClass}>{c.reviewType}</td>
                                            <td className={tdClass}>{c.itemTotal?.toLocaleString()}원</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* ✅ [추가] 단가표 모달 */}
            {isPriceModalOpen && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50"
                    onClick={() => setIsPriceModalOpen(false)} // 배경 클릭 시 닫기
                >
                    <div 
                        className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md animate-fade-in-up"
                        onClick={(e) => e.stopPropagation()} // 모달 내부 클릭 시 닫히지 않도록
                    >
                        <h3 className="text-2xl font-bold mb-6 text-gray-800 text-center">리뷰 캠페인 단가표</h3>
                        
                        <div className="mb-6">
                            <h4 className="text-lg font-semibold mb-2 text-gray-700">📦 실배송</h4>
                            <table className="w-full text-sm text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-100">
                                        <th className="p-2 border">리뷰 종류</th>
                                        <th className="p-2 border text-right">단가</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr><td className="p-2 border">별점</td><td className="p-2 border text-right">1,600원</td></tr>
                                    <tr><td className="p-2 border">텍스트</td><td className="p-2 border text-right">1,700원</td></tr>
                                    <tr><td className="p-2 border">포토</td><td className="p-2 border text-right">1,800원</td></tr>
                                    <tr><td className="p-2 border">프리미엄(포토)</td><td className="p-2 border text-right">4,000원</td></tr>
                                    <tr><td className="p-2 border">프리미엄(영상)</td><td className="p-2 border text-right">5,000원</td></tr>
                                </tbody>
                            </table>
                        </div>

                        <div>
                            <h4 className="text-lg font-semibold mb-2 text-gray-700">👻 빈박스</h4>
                            <table className="w-full text-sm text-left border-collapse">
                                 <thead>
                                    <tr className="bg-gray-100">
                                        <th className="p-2 border">리뷰 종류</th>
                                        <th className="p-2 border text-right">단가</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr><td className="p-2 border">별점</td><td className="p-2 border text-right">5,400원</td></tr>
                                    <tr><td className="p-2 border">텍스트</td><td className="p-2 border text-right">5,400원</td></tr>
                                </tbody>
                            </table>
                        </div>

                        <p className="text-xs text-gray-500 mt-4">* 일요일/공휴일 진행 시 <strong className="text-red-500">600원</strong>의 가산금이 추가됩니다.</p>
                        
                        <div className="mt-8 text-center">
                            <button onClick={() => setIsPriceModalOpen(false)} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-6 rounded-lg">
                                닫기
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {confirmCampaign && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setConfirmCampaign(null)}>
                    <div className="bg-white p-6 rounded shadow" onClick={(e) => e.stopPropagation()}>
                        <p className="mb-4">예약확정하겠습니까?</p>
                        <div className="flex justify-center space-x-4">
                            <button className="px-4 py-2 bg-blue-600 text-white rounded" onClick={handleConfirmReservation}>예</button>
                            <button className="px-4 py-2 bg-gray-300 rounded" onClick={() => setConfirmCampaign(null)}>아니오</button>
                        </div>
                    </div>
                </div>
            )}

            {showDepositPopup && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowDepositPopup(false)}>
                    <div className="bg-white p-6 rounded shadow" onClick={(e) => e.stopPropagation()}>
                        <p className="font-semibold text-lg mb-2">채종문(아이언마운틴컴퍼니)</p>
                        <p className="font-semibold text-lg">국민은행 834702-04-290385</p>
                        <button className="mt-4 px-4 py-2 bg-blue-600 text-white rounded" onClick={() => setShowDepositPopup(false)}>확인</button>
                    </div>
                </div>
            )}
        </SellerLayout>
    );
}
