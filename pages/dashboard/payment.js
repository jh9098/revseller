import { useEffect, useRef, useState } from 'react';
import { nanoid } from 'nanoid';
import { db, auth } from '../../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth'; // onAuthStateChanged 임포트

//const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;
const clientKey = "test_gck_docs_Ovk5rk1EwkEbP0W43n07xlzm";
// 실제 배포 시에는 환경변수로 관리하는 것이 좋습니다.
export default function PaymentPage() {
  const paymentWidgetRef = useRef(null);
  const [paymentAmount, setPaymentAmount] = useState(null);
  const [loadingMessage, setLoadingMessage] = useState('결제 정보를 불러오는 중입니다...');

  useEffect(() => {
    // 로그인 상태가 변경될 때마다 이 함수가 실행됨 (페이지 첫 로드 포함)
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // 1. 사용자가 로그인된 것이 확실해지면,
        console.log("로그인 확인됨, 사용자 UID:", user.uid);
        
        const fetchSellerData = async () => {
          const sellerDocRef = doc(db, 'sellers', user.uid);
          const sellerDocSnap = await getDoc(sellerDocRef);

          if (sellerDocSnap.exists()) {
            // 2. 관리자가 설정한 paymentAmount 값을 가져옴 (없으면 기본값 50000)
            const amount = sellerDocSnap.data().paymentAmount || 50000;
            console.log("결제 금액 확인:", amount);
            setPaymentAmount(amount);
          } else {
            console.log("판매자 정보를 찾을 수 없습니다. 기본값으로 설정합니다.");
            setPaymentAmount(50000); // 비상시 기본값 설정
          }
        };

        fetchSellerData();

      } else {
        // 사용자가 로그아웃 상태일 경우
        console.log("로그인된 사용자가 없습니다.");
        setLoadingMessage('로그인이 필요합니다. 로그인 페이지로 이동합니다.');
        // 필요하다면 로그인 페이지로 리디렉션
        // router.push('/'); 
      }
    });

    // 컴포넌트가 사라질 때 리스너 정리
    return () => unsubscribe();
  }, []); // 이 useEffect는 처음에 한번만 실행되어 리스너를 등록합니다.

  useEffect(() => {
    if (paymentAmount === null) return; 

    const fetchPaymentWidget = async () => {
      const paymentWidget = await window.PaymentWidget(clientKey, window.PaymentWidget.ANONYMOUS);
      paymentWidget.renderPaymentMethods(
        '#payment-method', 
        { value: paymentAmount },
        { variantKey: "DEFAULT" }
      );
      paymentWidgetRef.current = paymentWidget;
    };

    fetchPaymentWidget();
  }, [paymentAmount]);

  const handlePayment = async () => {
    const paymentWidget = paymentWidgetRef.current;
    if (!paymentWidget) {
        alert('결제 위젯이 로드되지 않았습니다.');
        return;
    }
    try {
        await paymentWidget.requestPayment({
            orderId: `order_${nanoid()}`,
            orderName: '판매자 플랜 결제',
            customerName: '판매자', // 실제로는 auth.currentUser.displayName 등을 사용
            successUrl: `${window.location.origin}/dashboard/products`,
            failUrl: `${window.location.origin}/dashboard/payment`,
        });
    } catch (err) {
        console.error("결제 요청 에러:", err);
        alert('결제 요청에 실패했습니다.');
    }
  };

  if (paymentAmount === null) {
    return <div>{loadingMessage}</div>;
  }

  return (
    <div>
      <h1>플랜 결제</h1>
      <div id="payment-method" />
      <button onClick={handlePayment} style={{ marginTop: '20px', padding: '10px 20px' }}>
        {paymentAmount.toLocaleString()}원 결제하기
      </button>
    </div>
  );
}