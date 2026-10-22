import React from 'react';
import { Product } from '../../types';
import { InventoryAnalytics } from './statistics/InventoryAnalytics';

export const InventoryAnalyticsModule = ({ products }: { products: Product[] }) => {
    return <InventoryAnalytics products={products} />;
};