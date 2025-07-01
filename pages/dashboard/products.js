// P:\revseller\pages\dashboard\products.js

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { db, auth } from '../../lib/firebase';
import { collection, serverTimestamp, query, where, onSnapshot, writeBatch, doc, updateDoc, FieldValue, increment } from 'firebase/firestore'; // updateDoc, increment 추가
import { useAuthState } from 'react-firebase-hooks/auth';
import { signOut } from 'firebase/auth';
import SellerLayout from '../../components/seller/SellerLayout';
import { nanoid } from 'nanoid';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

// --- getBasePrice, initialFormState는 기존과 동일 ---
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
const initialFormState = {
    date: new Date(), deliveryType: '실배송', reviewType: '별점', quantity: 1, productName: '',
    productOption: '', productPrice: 0, productUrl: '', keywords: '', reviewGuide: '', remarks: ''
};


export default function DashboardPage() {
    const [user, loading] = useAuthState(auth);
    const router = useRouter();

    // --- 상태 관리 ---
    const [formState, setFormState] = useState(initialFormState);
    const [campaigns, setCampaigns] = useState([]); // 로컬 견적 목록
    const [totalAmount, setTotalAmount] = useState(0); // 수수료 포함 총 결제액
    const [savedCampaigns, setSavedCampaigns] = useState([]); // DB 저장된 내역
    const [isLoadingDB, setIsLoadingDB] = useState(true);

    // ✅ [추가] 예치금 관련 상태
    const [deposit, setDeposit] = useState(0); // 판매자 예치금
    const [useDeposit, setUseDeposit] = useState(false); // 예치금 사용 여부

    // --- 계산 로직 ---
    const basePrice = getBasePrice(formState.deliveryType, formState.reviewType);
    const sundayExtraCharge = formState.date.getDay() === 0 ? 600 : 0;
    const finalUnitPrice = basePrice + sundayExtraCharge;

    // ✅ [추가] 예치금 사용에 따른 최종 결제액 계산
    const amountToUseFromDeposit = useDeposit ? Math.min(totalAmount, deposit) : 0;
    const remainingPayment = totalAmount - amountToUseFromDeposit;

    // --- useEffect 훅 ---
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
        const quoteTotal = campaigns.reduce((sum, campaign) => sum + campaign.itemTotal, 0);
        const final = Math.round(quoteTotal * 1.14);
        setTotalAmount(final);
    }, [campaigns]);

    useEffect(() => {
        if (loading) return;
        if (!user) {
            router.push('/');
            return;
        }
        
        // 내 캠페인 목록 불러오기
        const q = query(collection(db, "campaigns"), where("sellerUid", "==", user.uid));
        const unsubscribeCampaigns = onSnapshot(q, (snapshot) => {
            setSavedCampaigns(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setIsLoadingDB(false);
        });

        // ✅ [추가] 판매자 정보(예치금 포함) 실시간으로 불러오기
        const sellerDocRef = doc(db, 'sellers', user.uid);
        const unsubscribeSeller = onSnapshot(sellerDocRef, (doc) => {
            if (doc.exists()) {
                setDeposit(doc.data().deposit || 0);
            }
        });

        return () => {
            unsubscribeCampaigns();
            unsubscribeSeller();
        };
    }, [user, loading, router]);


    // --- 핸들러 함수 ---
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

    // ✅ [수정] 결제 처리 로직 (예치금 기능 통합)
    const handleProcessPayment = async () => {
        if (campaigns.length === 0 || !user) {
            alert('결제할 견적 항목이 없습니다.');
            return;
        }

        const batch = writeBatch(db);
        const sellerDocRef = doc(db, 'sellers', user.uid);

        // 1. 캠페인 정보 배치에 추가
        campaigns.forEach(campaign => {
            const { id, ...campaignData } = campaign;
            const campaignRef = doc(collection(db, 'campaigns'));
            batch.set(campaignRef, {
                ...campaignData, sellerUid: user.uid, createdAt: serverTimestamp(), status: '미확정'
            });
        });

        // 2. 예치금 사용 시, 예치금 차감 로직 배치에 추가
        if (useDeposit && amountToUseFromDeposit > 0) {
            batch.update(sellerDocRef, {
                deposit: increment(-amountToUseFromDeposit)
            });
        }

        try {
            await batch.commit();

            // 3. 결제 후 처리
            if (remainingPayment > 0) {
                // PG 결제 필요
                alert(`예치금 ${amountToUseFromDeposit.toLocaleString()}원이 사용되었습니다.\n차액 ${remainingPayment.toLocaleString()}원 결제를 진행합니다.`);
                router.push(`/dashboard/payment?amount=${remainingPayment}`);
            } else {
                // 예치금으로 전액 결제 완료
                alert('예치금으로 결제가 완료되었습니다.');
                setCampaigns([]);
                setUseDeposit(false);
            }
        } catch (error) {
            console.error('결제 처리 중 오류 발생:', error);
            alert('결제 처리 중 오류가 발생했습니다.');
        }
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
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
                    <h1 className="text-3xl font-bold text-gray-800">리뷰 캠페인 대시보드</h1>
                    {/* ✅ [수정] 예치금 표시 UI */}
                    <div className="mt-4 sm:mt-0 flex items-center">
                        <span className="mr-4 text-gray-600">
                            <strong>예치금:</strong> <span className="font-bold text-blue-600">{deposit.toLocaleString()}원</span>
                        </span>
                        <span className="mr-4 text-gray-600">{user?.email}</span>
                        <button onClick={handleLogout} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg">
                            로그아웃
                        </button>
                    </div>
                </div>

                {/* --- 새 작업 추가 폼 (기존과 동일) --- */}
                <form onSubmit={handleAddCampaign} className="p-6 bg-white rounded-xl shadow-lg mb-8">
                    {/* ... form 내부 내용은 생략 (기존 코드와 동일) ... */}
                </form>

                <div className="p-6 bg-white rounded-xl shadow-lg">
                    <h2 className="text-2xl font-bold mb-4 text-gray-700">견적 목록 (스프레드시트)</h2>
                    {/* --- 견적 목록 테이블 (기존과 동일) --- */}
                    <div className="overflow-x-auto">
                        {/* ... table 내용은 생략 (기존 코드와 동일) ... */}
                    </div>

                    {/* ✅ [수정] 최종 결제 금액 및 예치금 사용 UI */}
                    <div className="mt-6 p-6 bg-gray-50 rounded-lg text-right">
                        <div className="space-y-2 mb-4">
                            <p className="text-gray-600 text-lg">
                                총 결제 금액: <span className="font-semibold">{totalAmount.toLocaleString()}</span> 원
                            </p>
                            <div className="flex justify-end items-center">
                                <label htmlFor="use-deposit" className="text-gray-600 text-lg mr-2">예치금 사용:</label>
                                <input
                                    type="checkbox"
                                    id="use-deposit"
                                    checked={useDeposit}
                                    onChange={(e) => setUseDeposit(e.target.checked)}
                                    disabled={deposit === 0 || totalAmount === 0}
                                    className="h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50"
                                />
                                <span className={`ml-2 text-red-500 font-semibold text-lg ${!useDeposit && 'opacity-50'}`}>
                                    - {amountToUseFromDeposit.toLocaleString()} 원
                                </span>
                            </div>
                            <hr className="my-2"/>
                            <p className="text-gray-800">
                                최종 결제 금액:
                                <span className="font-bold text-3xl text-blue-700 ml-4">
                                    {remainingPayment.toLocaleString()}
                                </span> 원
                            </p>
                        </div>
                        <button onClick={handleProcessPayment} disabled={campaigns.length === 0}
                            className="mt-4 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-lg text-lg shadow-lg disabled:bg-gray-400 disabled:cursor-not-allowed">
                            결제 진행
                        </button>
                    </div>
                </div>
                
                {/* --- 나의 예약 내역 테이블 (기존과 동일) --- */}
                <div className="mt-8 p-6 bg-white rounded-xl shadow-lg">
                    <h2 className="text-2xl font-bold mb-4 text-gray-700">나의 예약 내역 (DB 저장 완료)</h2>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-100">
                                <tr>{['진행일자', '상품명', '리뷰 종류', '총 견적', '결제상태'].map(h => <th key={h} className={thClass}>{h}</th>)}</tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {savedCampaigns.length === 0 ? (
                                    <tr><td colSpan="5" className="text-center py-10 text-gray-500">예약 내역이 없습니다.</td></tr>
                                ) : (
                                    savedCampaigns.map(c => (
                                        <tr key={c.id}>
                                            <td className={tdClass}>{c.date?.seconds ? new Date(c.date.seconds * 1000).toLocaleDateString() : '-'}</td>
                                            <td className={tdClass}>{c.productName}</td>
                                            <td className={tdClass}>{c.reviewType}</td>
                                            <td className={tdClass}>{c.itemTotal?.toLocaleString()}원</td>
                                            <td className={tdClass}><span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${c.status === '예약 확정' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{c.status}</span></td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </SellerLayout>
    );
}