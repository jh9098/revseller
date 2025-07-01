// P:\revseller\pages\dashboard\payment.js
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router'; // useRouter 임포트
import { nanoid } from 'nanoid';
import { db, auth } from '../../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

const clientKey = "test_gck_docs_Ovk5rk1EwkEbP0W43n07xlzm";

export default function PaymentPage() {
    const paymentWidgetRef = useRef(null);
    const [paymentAmount, setPaymentAmount] = useState(null);
    const [loadingMessage, setLoadingMessage] = useState('결제 정보를 불러오는 중입니다...');
    const router = useRouter(); // router 훅 사용

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                // ✅ [수정] 쿼리 파라미터로 전달된 금액이 있는지 먼저 확인
                const amountFromQuery = router.query.amount;
                if (amountFromQuery) {
                    setPaymentAmount(Number(amountFromQuery));
                } else {
                    // 쿼리 파라미터가 없으면 기존 로직(고정 플랜 결제) 수행
                    const fetchSellerData = async () => {
                        const sellerDocRef = doc(db, 'sellers', user.uid);
                        const sellerDocSnap = await getDoc(sellerDocRef);
                        if (sellerDocSnap.exists()) {
                            setPaymentAmount(sellerDocSnap.data().paymentAmount || 50000);
                        } else {
                            setPaymentAmount(50000);
                        }
                    };
                    fetchSellerData();
                }
            } else {
                setLoadingMessage('로그인이 필요합니다. 로그인 페이지로 이동합니다.');
                // router.push('/'); 
            }
        });
        return () => unsubscribe();
    }, [router.isReady]); // router.isReady를 의존성 배열에 추가하여 쿼리 파라미터를 안정적으로 읽도록 함

    useEffect(() => {
        if (paymentAmount === null || paymentAmount <= 0) return;

        const fetchPaymentWidget = async () => {
            try {
                const paymentWidget = await window.PaymentWidget(clientKey, window.PaymentWidget.ANONYMOUS);
                paymentWidget.renderPaymentMethods(
                    '#payment-method', 
                    { value: paymentAmount },
                    { variantKey: "DEFAULT" }
                );
                paymentWidgetRef.current = paymentWidget;
            } catch (error) {
                console.error("결제 위젯 렌더링 실패:", error);
                setLoadingMessage("결제 위젯을 불러오는 데 실패했습니다. 새로고침 해주세요.");
            }
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
                orderName: '리뷰 마케팅 캠페인 결제',
                customerName: auth.currentUser?.displayName || '판매자',
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
            <h1>캠페인 결제</h1>
            <div id="payment-method" />
            <button onClick={handlePayment} style={{ marginTop: '20px', padding: '10px 20px' }}>
                {paymentAmount.toLocaleString()}원 결제하기
            </button>
        </div>
    );
}