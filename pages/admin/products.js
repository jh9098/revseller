import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { db, auth } from '../../lib/firebase';
import { collection, addDoc, serverTimestamp, query, where, onSnapshot, writeBatch, doc } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { signOut } from 'firebase/auth';
import { nanoid } from 'nanoid';

// 달력 컴포넌트 임포트
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

// 토스페이먼츠 결제 버튼 임포트 (이전 파일 재사용)
// import { PaymentButton } from '../../components/PaymentButton'; // 실제 경로에 맞게 수정 필요

// --- 핵심 로직: 가격 계산 엔진 ---
const calculatePrice = (deliveryType, reviewType) => {
  if (deliveryType === '실배송') {
    switch (reviewType) {
      case '단순구매':
      case '별점':
        return 1600;
      case '텍스트':
        return 1700;
      case '포토':
        return 1800;
      case '프리미엄(영상)':
        return 1800 + 3200; // 포토 가격 + 추가금
      case '프리미엄(포토)':
        return 1800 + 2200; // 포토 가격 + 추가금
      default:
        return 0;
    }
  } else if (deliveryType === '빈박스') {
    switch (reviewType) {
      case '별점':
      case '텍스트':
        return 5500;
      default:
        return 0; // 빈박스 + 다른 리뷰 종류는 가격 정책이 없으므로 0원 처리
    }
  }
  return 0;
};


export default function DashboardPage() {
  const [user, loading] = useAuthState(auth);
  const router = useRouter();

  // 1. 견적 생성을 위한 폼 상태
  const [campaignDate, setCampaignDate] = useState(new Date());
  const [deliveryType, setDeliveryType] = useState('실배송');
  const [reviewType, setReviewType] = useState('단순구매');

  // 2. 생성된 견적 목록 (스프레드시트) 상태
  const [campaigns, setCampaigns] = useState([]);

  // 3. 최종 결제 금액 계산 상태
  const [quote, setQuote] = useState(0);
  const [finalAmount, setFinalAmount] = useState(0);

  // 4. DB에서 불러온 기존 캠페인 목록 상태
  const [savedCampaigns, setSavedCampaigns] = useState([]);
  const [isLoadingDB, setIsLoadingDB] = useState(true);

  // 로그아웃 핸들러
  const handleLogout = async () => {
    await signOut(auth);
    router.push('/');
  };
  
  // 견적 항목 추가 핸들러
  const handleAddCampaign = () => {
    const price = calculatePrice(deliveryType, reviewType);
    if (price === 0) {
      alert('해당 조합의 가격 정책이 없습니다. 선택을 확인해주세요.');
      return;
    }
    const newCampaign = {
      id: nanoid(), // 고유 ID 생성
      date: campaignDate,
      deliveryType,
      reviewType,
      price,
    };
    setCampaigns([...campaigns, newCampaign]);
  };

  // 견적 항목 삭제 핸들러
  const handleDeleteCampaign = (id) => {
    setCampaigns(campaigns.filter(c => c.id !== id));
  };
  
  // 견적 목록이 변경될 때마다 총 견적비와 최종 결제금액 실시간 계산
  useEffect(() => {
    const totalQuote = campaigns.reduce((sum, campaign) => sum + campaign.price, 0);
    setQuote(totalQuote);
    
    // 부가세 10% + 대행수수료 4% = 총 14%
    const final = Math.round(totalQuote * 1.14);
    setFinalAmount(final);
  }, [campaigns]);

  // 로그인 상태 및 DB 데이터 로드
  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push('/');
      return;
    }

    // DB에서 이 사용자가 저장한 캠페인 목록을 실시간으로 가져옴
    const q = query(collection(db, "campaigns"), where("sellerUid", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const dbData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSavedCampaigns(dbData);
      setIsLoadingDB(false);
    });

    return () => unsubscribe();
  }, [user, loading, router]);
  
  // 최종 결제 및 DB 저장 핸들러
  const handleProcessPayment = async () => {
    if (campaigns.length === 0) {
      alert('결제할 견적 항목이 없습니다. 먼저 항목을 추가해주세요.');
      return;
    }

    // 1. 현재 견적 목록을 '미확정' 상태로 Firestore에 저장
    const batch = writeBatch(db);
    const campaignIds = campaigns.map(c => c.id);

    campaigns.forEach(campaign => {
      const campaignRef = doc(db, 'campaigns', `${user.uid}_${campaign.id}`);
      batch.set(campaignRef, {
        sellerUid: user.uid,
        date: campaign.date,
        deliveryType: campaign.deliveryType,
        reviewType: campaign.reviewType,
        price: campaign.price,
        status: '미확정', // 초기 상태
        createdAt: serverTimestamp(),
      });
    });

    try {
      await batch.commit();
      
      // 2. 토스페이먼츠 결제창 열기 (실제 구현 시 컴포넌트 또는 함수 호출)
      // 이 부분은 기존 Payment 로직을 재활용/수정해야 합니다.
      alert(`총 ${finalAmount.toLocaleString()}원 결제를 진행합니다.\n(PG사 연동 필요)`);
      
      // TODO: 토스 결제 위젯 호출
      // 성공 시 successUrl에서 상태를 '예약 확정'으로 업데이트하는 로직 필요
      
      // 결제 요청 후, 임시 견적 목록은 비움
      setCampaigns([]);

    } catch (error) {
      console.error("DB 저장 오류: ", error);
      alert("견적을 저장하는 중 오류가 발생했습니다.");
    }
  };


  if (loading || isLoadingDB) return <p>로딩 중...</p>;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-bold">리뷰 캠페인 대시보드</h1>
        <div>
          <span className="mr-4">{user?.email}님, 환영합니다.</span>
          <button onClick={handleLogout} className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded">
            로그아웃
          </button>
        </div>
      </div>

      {/* 견적 생성 섹션 */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8 p-6 bg-white rounded-lg shadow-md">
        <div>
          <label className="block font-semibold">진행일자</label>
          <DatePicker selected={campaignDate} onChange={(date) => setCampaignDate(date)} className="w-full p-2 border rounded-md" />
        </div>
        <div>
          <label className="block font-semibold">구분</label>
          <select value={deliveryType} onChange={(e) => setDeliveryType(e.target.value)} className="w-full p-2 border rounded-md">
            <option value="실배송">실배송</option>
            <option value="빈박스">빈박스</option>
          </select>
        </div>
        <div>
          <label className="block font-semibold">리뷰 종류</label>
          <select value={reviewType} onChange={(e) => setReviewType(e.target.value)} className="w-full p-2 border rounded-md">
            <optgroup label="실배송">
              <option value="단순구매">단순구매</option>
              <option value="별점">별점</option>
              <option value="텍스트">텍스트</option>
              <option value="포토">포토</option>
              <option value="프리미엄(포토)">프리미엄(포토)</option>
              <option value="프리미엄(영상)">프리미엄(영상)</option>
            </optgroup>
            <optgroup label="빈박스">
              <option value="별점">별점</option>
              <option value="텍스트">텍스트</option>
            </optgroup>
          </select>
        </div>
        <div className="flex items-end">
          <p className="text-xl font-bold">{calculatePrice(deliveryType, reviewType).toLocaleString()} 원</p>
        </div>
        <div className="flex items-end">
          <button onClick={handleAddCampaign} className="w-full bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
            견적에 추가
          </button>
        </div>
      </div>

      {/* 견적 목록 및 결제 섹션 */}
      <div className="p-6 bg-white rounded-lg shadow-md">
        <h2 className="text-2xl font-bold mb-4">견적 목록</h2>
        <div className="mb-4">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="th">진행일자</th>
                <th className="th">구분</th>
                <th className="th">리뷰 종류</th>
                <th className="th">단가</th>
                <th className="th">작업</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map(c => (
                <tr key={c.id}>
                  <td className="td">{c.date.toLocaleDateString()}</td>
                  <td className="td">{c.deliveryType}</td>
                  <td className="td">{c.reviewType}</td>
                  <td className="td">{c.price.toLocaleString()}원</td>
                  <td className="td">
                    <button onClick={() => handleDeleteCampaign(c.id)} className="text-red-500">삭제</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <hr className="my-4"/>
        <div className="text-right">
          <p>총 견적비: <span className="font-bold text-xl">{quote.toLocaleString()}</span> 원</p>
          <p className="text-sm text-gray-600">(부가세 10% + 대행수수료 4% 포함)</p>
          <p className="mt-2">최종 결제 금액: <span className="font-bold text-2xl text-blue-600">{finalAmount.toLocaleString()}</span> 원</p>
          <button onClick={handleProcessPayment} className="mt-4 bg-green-500 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg text-lg">
            결제 및 예약 확정 진행
          </button>
        </div>
      </div>
      
      {/* DB에 저장된 히스토리 */}
      <div className="mt-8 p-6 bg-white rounded-lg shadow-md">
        <h2 className="text-2xl font-bold mb-4">예약 내역</h2>
        <table className="min-w-full divide-y divide-gray-200">
          <thead>
            <tr>
              <th className="th">진행일자</th>
              <th className="th">리뷰 종류</th>
              <th className="th">금액</th>
              <th className="th">상태</th>
            </tr>
          </thead>
          <tbody>
            {savedCampaigns.map(c => (
              <tr key={c.id}>
                <td className="td">{new Date(c.date.seconds * 1000).toLocaleDateString()}</td>
                <td className="td">{c.reviewType}</td>
                <td className="td">{c.price.toLocaleString()}원</td>
                <td className={`td font-bold ${c.status === '예약 확정' ? 'text-green-600' : 'text-yellow-600'}`}>
                  {c.status}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// 스타일 재사용을 위한 임시 클래스 정의 (실제로는 globals.css에 추가)
const th = "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider";
const td = "px-6 py-4 whitespace-nowrap";