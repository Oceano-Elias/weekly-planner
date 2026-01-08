/**
 * Department Hierarchy Data and Logic
 * Supports 4+ levels of nested departments with colors and abbreviations
 */

export const DepartmentData = {
    WORK: {
        color: '#3B82F6',
        abbr: 'W',
        children: {
            'Social Media': {
                abbr: 'SM',
                children: {
                    YouTube: {
                        abbr: 'YT',
                        children: {
                            Script: { abbr: 'SC' },
                            Filming: { abbr: 'FM' },
                            Editing: { abbr: 'ED' },
                            Thumbnail: { abbr: 'TH' },
                            Upload: { abbr: 'UP' }
                        }
                    },
                    Instagram: {
                        abbr: 'IG',
                        children: {
                            Reels: { abbr: 'RL' },
                            Stories: { abbr: 'ST' },
                            Posts: { abbr: 'PO' },
                            Captions: { abbr: 'CP' }
                        }
                    },
                    TikTok: {
                        abbr: 'TT',
                        children: {
                            Content: { abbr: 'CT' },
                            Trends: { abbr: 'TR' }
                        }
                    },
                    Twitter: {
                        abbr: 'TW',
                        children: {
                            Threads: { abbr: 'TH' },
                            Engagement: { abbr: 'EG' }
                        }
                    }
                }
            },
            Projects: {
                abbr: 'PJ',
                children: {
                    'Project Alpha': { abbr: 'PA' },
                    'Project Beta': { abbr: 'PB' },
                    'Project Gamma': { abbr: 'PG' }
                }
            },
            Meetings: {
                abbr: 'MT',
                children: {
                    'Team Sync': { abbr: 'TS' },
                    'Client Call': { abbr: 'CC' },
                    'One-on-One': { abbr: '1:1' }
                }
            },
            Admin: {
                abbr: 'AD',
                children: {
                    Email: { abbr: 'EM' },
                    Planning: { abbr: 'PL' },
                    Reports: { abbr: 'RP' }
                }
            }
        }
    },
    PERSONAL: {
        color: '#10B981',
        abbr: 'P',
        children: {
            Home: {
                abbr: 'HM',
                children: {
                    Cleaning: { abbr: 'CL' },
                    Cooking: { abbr: 'CK' },
                    Maintenance: { abbr: 'MN' },
                    Shopping: { abbr: 'SH' }
                }
            },
            Family: {
                abbr: 'FM',
                children: {
                    Kids: { abbr: 'KD' },
                    Partner: { abbr: 'PT' },
                    Parents: { abbr: 'PR' }
                }
            },
            Social: {
                abbr: 'SC',
                children: {
                    Friends: { abbr: 'FR' },
                    Events: { abbr: 'EV' }
                }
            }
        }
    },
    HEALTH: {
        color: '#F59E0B',
        abbr: 'H',
        children: {
            Fitness: {
                abbr: 'FT',
                children: {
                    Gym: { abbr: 'GY' },
                    Running: { abbr: 'RN' },
                    Yoga: { abbr: 'YG' },
                    Swimming: { abbr: 'SW' }
                }
            },
            Medical: {
                abbr: 'MD',
                children: {
                    'Doctor Visits': { abbr: 'DV' },
                    'Dental': { abbr: 'DN' },
                    'Therapy': { abbr: 'TH' }
                }
            },
            Wellness: {
                abbr: 'WL',
                children: {
                    Meditation: { abbr: 'MT' },
                    Sleep: { abbr: 'SL' },
                    Nutrition: { abbr: 'NT' }
                }
            }
        }
    },
    LEARNING: {
        color: '#8B5CF6',
        abbr: 'L',
        children: {
            Courses: {
                abbr: 'CR',
                children: {
                    Online: { abbr: 'ON' },
                    'In-Person': { abbr: 'IP' },
                    Workshops: { abbr: 'WS' }
                }
            },
            Reading: {
                abbr: 'RD',
                children: {
                    Books: { abbr: 'BK' },
                    Articles: { abbr: 'AR' },
                    Research: { abbr: 'RS' }
                }
            },
            Practice: {
                abbr: 'PR',
                children: {
                    Coding: { abbr: 'CD' },
                    Design: { abbr: 'DS' },
                    Writing: { abbr: 'WR' }
                }
            }
        }
    },
    FINANCE: {
        color: '#EC4899',
        abbr: 'F',
        children: {
            Budgeting: {
                abbr: 'BD',
                children: {
                    'Monthly Review': { abbr: 'MR' },
                    'Expense Tracking': { abbr: 'ET' }
                }
            },
            Investing: {
                abbr: 'IV',
                children: {
                    Research: { abbr: 'RS' },
                    'Portfolio Review': { abbr: 'PR' }
                }
            },
            Bills: {
                abbr: 'BL',
                children: {
                    Utilities: { abbr: 'UT' },
                    Subscriptions: { abbr: 'SB' }
                }
            }
        }
    },
    ADMIN: {
        color: '#6366F1',
        abbr: 'A',
        children: {
            Documents: {
                abbr: 'DC',
                children: {
                    Filing: { abbr: 'FL' },
                    Scanning: { abbr: 'SC' }
                }
            },
            'Life Admin': {
                abbr: 'LA',
                children: {
                    Appointments: { abbr: 'AP' },
                    Errands: { abbr: 'ER' },
                    'Phone Calls': { abbr: 'PC' }
                }
            }
        }
    }
};

/**
 * Department utility functions
 */
export const Departments = {
    /**
     * Get all top-level departments
     */
    getTopLevel() {
        return Object.keys(DepartmentData);
    },

    /**
     * Get department data by name
     */
    get(name) {
        return DepartmentData[name];
    },

    /**
     * Get color for a department path
     */
    getColor(hierarchy) {
        if (!hierarchy || hierarchy.length === 0) return '#666';
        const topLevel = hierarchy[0];
        return DepartmentData[topLevel]?.color || '#666';
    },

    /**
     * Get abbreviation for a department
     */
    getAbbreviation(hierarchy) {
        if (!hierarchy || hierarchy.length === 0) return '';

        let current = DepartmentData;
        let abbr = '';

        for (let i = 0; i < hierarchy.length; i++) {
            const name = hierarchy[i];
            if (i === 0) {
                current = current[name];
            } else {
                current = current?.children?.[name];
            }
            if (current?.abbr) {
                abbr = current.abbr;
            }
        }

        return abbr;
    },

    /**
     * Get children of a department path
     */
    getChildren(hierarchy) {
        if (!hierarchy || hierarchy.length === 0) {
            return Object.keys(DepartmentData);
        }

        let current = DepartmentData;

        for (let i = 0; i < hierarchy.length; i++) {
            const name = hierarchy[i];
            if (i === 0) {
                current = current[name];
            } else {
                current = current?.children?.[name];
            }
            if (!current) return [];
        }

        return current?.children ? Object.keys(current.children) : [];
    },

    /**
     * Check if a department has children
     */
    hasChildren(hierarchy) {
        return this.getChildren(hierarchy).length > 0;
    },

    /**
     * Format hierarchy as a breadcrumb string
     */
    formatPath(hierarchy, separator = ' › ') {
        if (!hierarchy || hierarchy.length === 0) return '';
        return hierarchy.join(separator);
    },

    /**
     * Get full hierarchy tree for filtering
     */
    getTree() {
        const buildTree = (obj, path = []) => {
            const result = [];

            for (const [name, data] of Object.entries(obj)) {
                const currentPath = [...path, name];
                const node = {
                    name,
                    path: currentPath,
                    color: path.length === 0 ? data.color : null,
                    abbr: data.abbr,
                    children: data.children ? buildTree(data.children, currentPath) : []
                };
                result.push(node);
            }

            return result;
        };

        return buildTree(DepartmentData);
    }
};
