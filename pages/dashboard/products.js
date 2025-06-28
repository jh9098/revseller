import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { db, auth } from '../../lib/firebase';
import { collection, addDoc, serverTimestamp, query, where, onSnapshot, writeBatch, doc } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { signOut } from 'firebase/auth';
import { nanoid } from 'nanoid';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

// --- 핵심 로직: 리뷰 단가 계산 ---
const getReviewPrice = (deliveryType, reviewType) => {
  if (deliveryType === '실배송') {
    switch (reviewType) {
      case '단순구매': case '별점': return 1600;
      case '텍스트': return 1700;
      case '포토': return 1800;
      case '프리미엄(포토)': return 1800 + 2200;
      case '프리미엄(영상)': return 1800 + 3200;
      default: return 0;
    }
  } else if (deliveryType === '빈박스') {
    switch (reviewType) {
      case '별점': case '텍스트': return 5500;
      default: return 0;
    }
  }
  return 0;
};

// --- 초기 폼 상태 ---
const initialFormState = {
  date: new Date(),
  deliveryType: '실배송',
  reviewType: '별점',
  quantity: 1,
  productName: '',
  productOption: '',
  productPrice: 0,
  productUrl: '',
  keywords: '',
  reviewGuide: '',
  remarks: ''
};

export default function DashboardPage() {
  const [user, loading] = useAuthState(auth);
  const router = useRouter();

  // 1. 입력 폼을 위한 상태
  const [formState, setFormState] = useState(initialFormState);
  
  // 2. 추가된 캠페인 목록 상태
  const [campaigns, setCampaigns] = useState([]);
  
  // 3. 최종 결제 금액 계산 상태
  const [totalAmount, setTotalAmount] = useState(0);
  
  // 4. DB에서 불러온 기존 캠페인 목록 상태
  const [savedCampaigns, setSavedCampaigns] = useState([]);
  const [isLoadingDB, setIsLoadingDB] = useState(true);

  // 폼 입력 변경 핸들러
  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormState(prev => ({ ...prev, [name]: value }));
  };

  // 견적 항목 추가 핸들러
  const handleAddCampaign = (e) => {
    e.preventDefault();
    const reviewPrice = getReviewPrice(formState.deliveryType, formState.reviewType);
    if (reviewPrice === 0) {
      alert('해당 조합의 가격 정책이 없습니다. 선택을 확인해주세요.');
      return;
    }
    // 각 항목의 총 견적 계산: (리뷰단가 + 상품가) * 작업개수
    const itemTotal = (reviewPrice + Number(formState.productPrice)) * Number(formState.quantity);

    const newCampaign = {
      id: nanoid(),
      ...formState,
      reviewPrice, // 개당 리뷰 단가
      itemTotal, // 이 항목의 총 견적
    };
    setCampaigns([...campaigns, newCampaign]);
    setFormState(initialFormState); // 폼 초기화
  };

  const handleDeleteCampaign = (id) => {
    setCampaigns(campaigns.filter(c => c.id !== id));
  };
  
  // 견적 목록 변경 시 최종 결제 금액 실시간 계산
  useEffect(() => {
    const quoteTotal = campaigns.reduce((sum, campaign) => sum + campaign.itemTotal, 0);
    const final = Math.round(quoteTotal * 1.14); // 부가세 10% + 수수료 4%
    setTotalAmount(final);
  }, [campaigns]);
  
  // ... (기존 useEffect 로그인 및 DB 로드 로직은 동일) ...
  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push('/');
      return;
    }
    const q = query(collection(db, "campaigns"), where("sellerUid", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setSavedCampaigns(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setIsLoadingDB(false);
    });
    return () => unsubscribe();
  }, [user, loading, router]);
  
  // 로그아웃 핸들러
  const handleLogout = async () => {
    await signOut(auth);
    router.push('/');
  };

  // 최종 결제 및 DB 저장
  const handleProcessPayment = async () => {
    if (campaigns.length === 0) {
      alert('결제할 견적 항목이 없습니다.');
      return;
    }
    // ... PG사 연동 로직 (이전과 동일) ...
    alert(`총 ${totalAmount.toLocaleString()}원 결제를 진행합니다.`);
  };

  if (loading || isLoadingDB) return <p>로딩 중...</p>;

  // --- JSX 렌더링 부분 ---
  return (
    <div className="p-4 md:p-8 bg-gray-100 min-h-screen">
      {/* 헤더 */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">판매자 대시보드</h1>
        <div>
          <span className="mr-4">{user?.email}</span>
          <button onClick={handleLogout} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg">
            로그아웃
          </button>
        </div>
      </div>

      {/* 입력 폼 */}
      <form onSubmit={handleAddCampaign} className="p-6 bg-white rounded-xl shadow-lg mb-8">
        <h2 className="text-2xl font-bold mb-6">새 작업 추가</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div>
            <label className="label">진행 일자</label>
            <DatePicker selected={formState.date} onChange={(date) => setFormState(p => ({...p, date}))} className="input" />
          </div>
          <div>
            <label className="label">구분</label>
            <select name="deliveryType" value={formState.deliveryType} onChange={handleFormChange} className="input">
              <option value="실배송">실배송</option>
              <option value="빈박스">빈박스</option>
            </select>
          </div>
          <div>
            <label className="label">리뷰 종류</label>
            <select name="reviewType" value={formState.reviewType} onChange={handleFormChange} className="input">
                <option>단순구매</option><option>별점</option><option>텍스트</option>
              {formState.deliveryType === '실배송' && (
                <><option>포토</option><option>프리미엄(포토)</option><option>프리미엄(영상)</option></>
              )}
            </select>
          </div>
           <div>
            <label className="label">작업 개수</label>
            <input type="number" name="quantity" value={formState.quantity} onChange={handleFormChange} className="input" min="1" />
          </div>
          <div className="md:col-span-2">
            <label className="label">상품명</label>
            <input type="text" name="productName" value={formState.productName} onChange={handleFormChange} className="input" placeholder="예: 헤드앤숄더 토탈 솔루션 샴푸" />
          </div>
           <div>
            <label className="label">옵션</label>
            <input type="text" name="productOption" value={formState.productOption} onChange={handleFormChange} className="input" placeholder="예: 1개" />
          </div>
          <div>
            <label className="label">상품가 (개당)</label>
            <input type="number" name="productPrice" value={formState.productPrice} onChange={handleFormChange} className="input" placeholder="숫자만 입력" />
          </div>
          <div className="md:col-span-2">
            <label className="label">상품 URL</label>
            <input type="url" name="productUrl" value={formState.productUrl} onChange={handleFormChange} className="input" placeholder="https://..." />
          </div>
          <div className="md:col-span-2">
            <label className="label">키워드</label>
            <input type="text" name="keywords" value={formState.keywords} onChange={handleFormChange} className="input" placeholder="콤마(,)로 구분하여 입력" />
          </div>
          <div className="md:col-span-2">
            <label className="label">리뷰 가이드</label>
            <textarea name="reviewGuide" value={formState.reviewGuide} onChange={handleFormChange} className="input" rows="2" placeholder="리뷰 작성 시 참고할 가이드라인"></textarea>
          </div>
           <div className="md:col-span-2">
            <label className="label">비고</label>
            <input type="text" name="remarks" value={formState.remarks} onChange={handleFormChange} className="input" placeholder="기타 전달 사항" />
          </div>
        </div>
        <div className="mt-6 text-right">
          <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg">
            견적 목록에 추가
          </button>
        </div>
      </form>

      {/* 견적 목록 테이블 및 결제 */}
      <div className="p-6 bg-white rounded-xl shadow-lg">
        <h2 className="text-2xl font-bold mb-4">견적 목록 (스프레드시트)</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-100">
              <tr>
                {['순번', '진행일자', '구분', '리뷰종류', '작업개수', '상품명', '상품가', '체험단 견적', '작업'].map(h => <th key={h} className={thClass}>{h}</th>)}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {campaigns.length === 0 ? (
                <tr><td colSpan="9" className="text-center py-10 text-gray-500">위에서 작업을 추가해주세요.</td></tr>
              ) : (
                campaigns.map((c, index) => (
                  <tr key={c.id}>
                    <td className={tdClass}>{index + 1}</td>
                    <td className={tdClass}>{c.date.toLocaleDateString()}</td>
                    <td className={tdClass}>{c.deliveryType}</td>
                    <td className={tdClass}>{c.reviewType}</td>
                    <td className={tdClass}>{c.quantity}</td>
                    <td className={tdClass}>{c.productName}</td>
                    <td className={tdClass}>{Number(c.productPrice).toLocaleString()}원</td>
                    <td className={tdClass}>{c.itemTotal.toLocaleString()}원</td>
                    <td className={tdClass}>
                      <button onClick={() => handleDeleteCampaign(c.id)} className="text-red-600 hover:text-red-800">삭제</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-6 p-4 bg-gray-50 rounded-lg text-right">
            <p className="text-gray-800">최종 결제 금액 (수수료 포함): <span className="font-bold text-3xl text-blue-700">{totalAmount.toLocaleString()}</span> 원</p>
            <button onClick={handleProcessPayment} disabled={campaigns.length === 0} className="mt-4 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-lg text-lg shadow-lg disabled:bg-gray-400">
                결제 진행
            </button>
        </div>
      </div>
    </div>
  );
}

// 스타일 재사용을 위한 변수 정의
const labelClass = "block text-sm font-medium text-gray-700 mb-1";
const inputClass = "w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500";
const thClass = "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider";
const tdClass = "px-4 py-3 whitespace-nowrap text-sm text-gray-800";