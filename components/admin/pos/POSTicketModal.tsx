import React from 'react';
import { Order } from '../../../types';
import { useStore } from '../../../context/StoreContext';
import { ReceiptModal } from '../orders/ReceiptModal';

interface POSTicketModalProps {
    isOpen: boolean;
    order: Order | null;
    onClose: () => void;
}

/**
 * POSTicketModal - Unificado al 100% con ReceiptModal de Pedidos.
 * Garantiza que el ticket térmico emitido en POS tenga exactamente
 * el mismo formato, diseño, cálculos y capacidades que el de Pedidos.
 */
export const POSTicketModal: React.FC<POSTicketModalProps> = ({ isOpen, order, onClose }) => {
    const { settings } = useStore();

    if (!isOpen || !order) return null;

    return <ReceiptModal order={order} settings={settings} onClose={onClose} />;
};
