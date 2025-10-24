import { Routes } from '@angular/router';

import { authGuard } from '../guards/auth.guard';

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
	{ 
		path: 'dashboard', 
		canActivate: [authGuard],
		...placeholder('Dashboard', 'Overview cards and quick stats will appear here soon.') 
	},
	{ 
		path: 'users', 
		canActivate: [authGuard],
		...placeholder('User Management', 'Create, list, and delete users once T049 lands.') 
	},
	{ 
		path: 'groups', 
		canActivate: [authGuard],
		...placeholder('Group Management', 'Manage groups and memberships from this view.') 
	},
	{ 
		path: 'expenses', 
		canActivate: [authGuard],
		...placeholder('Expense Tracking', 'Log and review shared expenses in this section.') 
	},
	{ 
		path: 'balances', 
		canActivate: [authGuard],
		...placeholder('Balance Summaries', 'Group and personal balances will show up here.') 
	},
	{ 
		path: 'activity', 
		canActivate: [authGuard],
		...placeholder('Activity Feed', 'Recent actions and history will be displayed here.') 
	},
	{ path: '**', redirectTo: 'login' }
];
