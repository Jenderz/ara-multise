
import React from 'react';
import { POSProvider } from '../../context/POSContext';
import { POSLayout } from './pos/POSLayout';

export const POSModule = () => {
    return (
        <POSProvider>
            <POSLayout />
        </POSProvider>
    );
};
