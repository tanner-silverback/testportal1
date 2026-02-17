import AdminClaims from './pages/AdminClaims';
import AdminCustomers from './pages/AdminCustomers';
import AdminEmailTemplates from './pages/AdminEmailTemplates';
import AdminPolicies from './pages/AdminPolicies';
import AdminREPros from './pages/AdminREPros';
import AdminUsers from './pages/AdminUsers';
import AdminZoho from './pages/AdminZoho';
import AgentView from './pages/AgentView';
import Claims from './pages/Claims';
import CustomerLogin from './pages/CustomerLogin';
import Dashboard from './pages/Dashboard';
import DashboardV2 from './pages/DashboardV2';
import Inbox from './pages/Inbox';
import Policies from './pages/Policies';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AdminClaims": AdminClaims,
    "AdminCustomers": AdminCustomers,
    "AdminEmailTemplates": AdminEmailTemplates,
    "AdminPolicies": AdminPolicies,
    "AdminREPros": AdminREPros,
    "AdminUsers": AdminUsers,
    "AdminZoho": AdminZoho,
    "AgentView": AgentView,
    "Claims": Claims,
    "CustomerLogin": CustomerLogin,
    "Dashboard": Dashboard,
    "DashboardV2": DashboardV2,
    "Inbox": Inbox,
    "Policies": Policies,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};