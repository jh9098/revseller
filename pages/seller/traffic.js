import { useState, useMemo } from 'react';
import SellerLayout from '../../components/seller/SellerLayout';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { ko } from 'date-fns/locale';

// --- 데이터 정의: 트래픽 상품 목록 (카테고리 순으로 정렬) ---
const initialTrafficProducts = [
  { category: '베이직 트래픽', name: '피에스타', description: '', retailPrice: 60000, discountRate: 1-33900/60000 },
  { category: '베이직 트래픽', name: '시그니처', description: '', retailPrice: 50000, discountRate: 1-31900/50000 },
  { category: '애드온 트래픽', name: 'CP', description: '', retailPrice: 60000, discountRate: 1-34900/60000 },
  { category: '애드온 트래픽', name: '솔트', description: '', retailPrice: 70000, discountRate: 1-41900/70000 },
  { category: '애드온 트래픽', name: 'BBS', description: '', retailPrice: 80000, discountRate: 1-34900/80000 },
  { category: '애드온 트래픽', name: '팡팡', description: '', retailPrice: 60000, discountRate: 1-39900/60000 },
];

export default function TrafficPage() {
  const [products, setProducts] = useState(
    initialTrafficProducts.map(p => ({
      ...p,
      salePrice: Math.round(p.retailPrice * (1 - p.discountRate)),
      quantity: 0,
      requestDate: null,
    }))
  );

  const categoryCounts = useMemo(() => {
    const counts = {};
    products.forEach(p => {
      counts[p.category] = (counts[p.category] || 0) + 1;
    });
    return counts;
  }, [products]);

  const handleInputChange = (index, field, value) => {
    const newProducts = [...products];
    const finalValue = field === 'quantity' ? Math.max(0, Number(value)) : value;
    newProducts[index] = { ...newProducts[index], [field]: finalValue };
    setProducts(newProducts);
  };

  const totalEstimate = products.reduce((sum, p) => sum + (p.salePrice * p.quantity), 0);

  // ✅ [수정] 헤더와 셀 스타일에 오른쪽 테두리 추가
  const thClass = "px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider bg-gray-100 border-b border-r border-gray-200";
  const tdClass = "px-4 py-3 whitespace-nowrap text-sm text-gray-800 border-b border-r border-gray-200";
  const inputClass = "w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-center";

  return (
    <SellerLayout>
      <div className="p-4 md:p-8 bg-gray-50 min-h-screen">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">트래픽 요청서</h1>
        <div className="mb-8 p-4 bg-blue-50 border-l-4 border-blue-400 text-gray-700 rounded-r-lg">
          <ul className="list-disc list-inside space-y-2 text-sm">
            <li>베이직 트래픽 2종은 자가 세팅 / 애드온 트래픽 4종은 정보 전달하여 개발사 대리 세팅</li>
            <li>베이직 트래픽 2종으로 상품 키워드별 순위 체크하시면 좋습니다. 상품마다 잘 작동하는 트래픽이 다를 수 있습니다. 애드온 트래픽으로 섞어 사용하여, 쿠팡 로직 변경에 적극 대응하시면 좋습니다.</li>
            <li>어떤 트래픽 프로그램을 사용하든 체험단 진행 혹은 오가닉 매출 발생이 필수적입니다. 트래픽만 사용했을 때 순위 보정 효과가 크지 않을 수 있습니다.</li>
          </ul>
        </div>

        <div className="bg-white rounded-xl shadow-lg overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr>
                <th className={`${thClass} w-40`}>구분</th>
                <th className={thClass}>상품명</th>
                <th className={thClass}>설명</th>
                <th className={`${thClass} w-48`}>가격</th>
                <th className={`${thClass} w-28`}>구매 개수</th>
                <th className={`${thClass} w-40`}>요청일자</th>
                <th className={`${thClass} w-32`}>시작일자</th>
                <th className={`${thClass} w-32`}>종료일자</th>
                {/* ✅ [수정] 마지막 헤더에는 오른쪽 테두리 제거 */}
                <th className={`${thClass} w-36 border-r-0`}>트래픽 견적</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {products.map((p, index) => {
                const startDate = p.requestDate ? new Date(p.requestDate.getTime() + 24 * 60 * 60 * 1000) : null;
                const endDate = startDate ? new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000) : null;
                const estimate = p.salePrice * p.quantity;

                const prevCategory = index > 0 ? products[index - 1].category : null;
                const isFirstOfCategory = p.category !== prevCategory;
                const rowSpanCount = isFirstOfCategory ? categoryCounts[p.category] : 0;

                return (
                  <tr key={index} className={isFirstOfCategory && index > 0 ? 'border-t-2 border-gray-300' : ''}>
                    
                    {isFirstOfCategory && (
                      <td rowSpan={rowSpanCount} className={`${tdClass} align-middle text-center font-bold bg-gray-50`}>
                        {p.category}
                      </td>
                    )}

                    <td className={`${tdClass} font-semibold`}>{p.name}</td>
                    <td className={tdClass}>{p.description}</td>
                    <td className={`${tdClass} text-xs`}>
                      <div className="flex flex-col">
                        <span>시중가: {p.retailPrice.toLocaleString()}원</span>
                        <span className="text-red-600">할인율: {p.discountRate * 100}%</span>
                        <span className="font-bold text-blue-600 text-sm">판매가: {p.salePrice.toLocaleString()}원</span>
                      </div>
                    </td>
                    <td className={tdClass}>
                      <input 
                        type="number"
                        value={p.quantity}
                        onChange={(e) => handleInputChange(index, 'quantity', e.target.value)}
                        className={inputClass}
                        min="0"
                      />
                    </td>
                    <td className={tdClass}>
                      <DatePicker
                        selected={p.requestDate}
                        onChange={(date) => handleInputChange(index, 'requestDate', date)}
                        className={inputClass}
                        dateFormat="yyyy/MM/dd"
                        locale={ko}
                        placeholderText="날짜 선택"
                      />
                    </td>
                    <td className={tdClass}>
                      {startDate ? startDate.toLocaleDateString() : '-'}
                    </td>
                    <td className={tdClass}>
                      {endDate ? endDate.toLocaleDateString() : '-'}
                    </td>
                    {/* ✅ [수정] 마지막 셀에는 오른쪽 테두리 제거 */}
                    <td className={`${tdClass} font-bold text-lg text-green-600 border-r-0`}>
                      {estimate.toLocaleString()}원
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="p-6 bg-gray-50 rounded-b-xl text-right">
            <p className="text-gray-800">
              최종 트래픽 견적 합계: 
              <span className="ml-4 font-bold text-3xl text-blue-700">{totalEstimate.toLocaleString()}</span> 원
            </p>
            <button
              disabled={totalEstimate === 0}
              className="mt-4 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-lg text-lg shadow-lg disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              견적 요청하기
            </button>
          </div>
        </div>
      </div>
    </SellerLayout>
  );
}