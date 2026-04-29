
import React from 'react';
import { useStore } from '../context/StoreContext';
import { ShopLayout } from '../components/Layout';
import { SEO } from '../components/SEO';

export const About = () => {
    const { settings } = useStore();

    return (
        <ShopLayout>
            <SEO 
                title="Nosotros" 
                description={settings.aboutUsText ? settings.aboutUsText.substring(0, 150) + "..." : "Conoce más sobre nuestra historia y compromiso."} 
            />
            
            <div className="max-w-4xl mx-auto py-12 px-4">
                <h1 className="text-4xl md:text-5xl font-serif font-bold text-center mb-8 text-ios-text dark:text-white">
                    Sobre {settings.storeName}
                </h1>
                <div className="bg-white dark:bg-white/5 rounded-[2.5rem] p-8 md:p-12 shadow-sm border border-gray-100 dark:border-white/10">
                    <div className="prose dark:prose-invert max-w-none text-lg leading-relaxed text-gray-600 dark:text-gray-300 whitespace-pre-wrap font-light">
                        {settings.aboutUsText}
                    </div>
                </div>
            </div>
        </ShopLayout>
    );
};
