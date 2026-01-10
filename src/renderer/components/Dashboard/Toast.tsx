import React from 'react';
import { useStore } from '../../store/useStore';
import { Info, CheckCircle, AlertTriangle, XCircle, X } from 'lucide-react';

export const Toast: React.FC = () => {
    const { notification, clearNotification } = useStore();

    if (!notification) return null;

    const icons = {
        info: <Info className="w-5 h-5 text-accent-primary" />,
        success: <CheckCircle className="w-5 h-5 text-accent-success" />,
        warning: <AlertTriangle className="w-5 h-5 text-accent-warning" />,
        error: <XCircle className="w-5 h-5 text-accent-danger" />,
    };

    const bgColors = {
        info: 'bg-accent-primary/10 border-accent-primary/20',
        success: 'bg-accent-success/10 border-accent-success/20',
        warning: 'bg-accent-warning/10 border-accent-warning/20',
        error: 'bg-accent-danger/10 border-accent-danger/20',
    };

    return (
        <div className="fixed bottom-6 right-6 z-[100] animate-in slide-in-from-right-full duration-300">
            <div className={`flex items-center gap-3 p-4 pr-12 rounded-xl border backdrop-blur-md shadow-2xl ${bgColors[notification.type]}`}>
                {icons[notification.type]}
                <p className="text-sm font-medium text-dark-100">{notification.message}</p>

                <button
                    onClick={clearNotification}
                    className="absolute top-1/2 -translate-y-1/2 right-3 p-1 rounded-lg text-dark-400 hover:text-dark-100 hover:bg-dark-100/10 transition-colors"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};
