
import React from 'react';
import { AppTab } from '../../types';

interface Tab {
    id: AppTab;
    label: string;
}

interface TabsProps {
    tabs: Tab[];
    activeTab: AppTab;
    setActiveTab: (tab: AppTab) => void;
}

const Tabs: React.FC<TabsProps> = ({ tabs, activeTab, setActiveTab }) => {
    return (
        <div className="flex justify-center mb-8">
            <div className="flex space-x-2 bg-base-200 p-1.5 rounded-xl border border-base-300">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`
                            px-4 py-2 text-sm sm:px-6 sm:py-2.5 sm:text-base font-medium rounded-lg transition-colors duration-300
                            ${activeTab === tab.id
                                ? 'bg-brand-primary text-white shadow-md'
                                : 'text-gray-300 hover:bg-base-300'
                            }
                        `}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default Tabs;
