import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const TOAST_ID = 'unique-toast-id';

function showToast(message) {
  if (!toast.isActive(TOAST_ID)) {
    toast.error(message, {
      position: "bottom-right",
      autoClose: 5000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      progress: undefined,
      toastId: TOAST_ID,
    });
  }
}

// 导出 showToast 函数
export default showToast;