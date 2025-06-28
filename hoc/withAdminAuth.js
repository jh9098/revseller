import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { auth, db } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

const withAdminAuth = (WrappedComponent) => {
  return (props) => {
    const router = useRouter();
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (user) {
          // 사용자가 로그인한 경우, role을 확인
          const userDocRef = doc(db, 'sellers', user.uid);
          const userDocSnap = await getDoc(userDocRef);

          if (userDocSnap.exists() && userDocSnap.data().role === 'admin') {
            // 관리자 역할이 맞으면 로딩 종료
            setLoading(false);
          } else {
            // 관리자가 아니면 판매자 대시보드나 메인 페이지로 리디렉션
            alert('접근 권한이 없습니다.');
            router.replace('/dashboard/products'); // 혹은 router.replace('/');
          }
        } else {
          // 로그인하지 않은 경우 로그인 페이지로 리디렉션
          router.replace('/');
        }
      });

      return () => unsubscribe();
    }, [router]);

    if (loading) {
      return <div>권한을 확인하는 중입니다...</div>;
    }

    return <WrappedComponent {...props} />;
  };
};

export default withAdminAuth;