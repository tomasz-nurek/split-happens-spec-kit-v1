import { Routes } from '@angular/router';

const placeholder = (feature: string, description: string) => ({
	loadComponent: () =>
		import('../components/feature-placeholder/feature-placeholder.component').then(
			(m) => m.FeaturePlaceholderComponent
		),
	data: { feature, description }
});

export const routes: Routes = [
	{ path: '', pathMatch: 'full', redirectTo: 'login' },
	{
		path: 'login',
		loadComponent: () =>
			import('../components/login/login.component').then((m) => m.LoginComponent)
	},
	{ path: 'dashboard', ...placeholder('Dashboard', 'Overview cards and quick stats will appear here soon.') },
	{ path: 'users', ...placeholder('User Management', 'Create, list, and delete users once T049 lands.') },
	{ path: 'groups', ...placeholder('Group Management', 'Manage groups and memberships from this view.') },
	{ path: 'expenses', ...placeholder('Expense Tracking', 'Log and review shared expenses in this section.') },
	{ path: 'balances', ...placeholder('Balance Summaries', 'Group and personal balances will show up here.') },
	{ path: 'activity', ...placeholder('Activity Feed', 'Recent actions and history will be displayed here.') },
	{ path: '**', redirectTo: 'login' }
];
