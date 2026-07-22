import React from 'react';
import { NavLink } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import { isAdminUser } from '../../lib/admin';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
	isActive ? 'text-accent-soft' : 'text-muted transition-colors hover:text-accent-soft';

// Rendered behind CLOUD_ENABLED (Clerk hooks need the provider). Visibility
// only — the admin API enforces its own allowlist.
const AdminNavLink: React.FC = () => {
	const { user } = useUser();
	if (!isAdminUser(user?.id)) return null;

	return (
		<li>
			<NavLink to="/admin" className={navLinkClass}>
				Admin
			</NavLink>
		</li>
	);
};

export default AdminNavLink;
