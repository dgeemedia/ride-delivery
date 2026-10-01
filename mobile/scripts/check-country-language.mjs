import { resolveAutoLanguage, languageForCountry, COUNTRY_LANGUAGE } from '../src/i18n/countryLanguage.js';
const supported = ['en','fr','pt','es','tr','da','de','zh','ar','hi','ru'];
let fail = 0;
const eq = (name, got, want) => { const ok = got === want; if (!ok) fail++; console.log(ok ? 'ok  ' : 'FAIL', name, '→', got, ok ? '' : `(wanted ${want})`); };
const r = (region, ...langs) => resolveAutoLanguage({ regionCode: region, deviceLanguages: langs, supported });

eq('Mali, English phone → French',          r('ML','en'), 'fr');
eq('Mali, French phone → French',           r('ML','fr'), 'fr');
eq('Senegal, English phone → French',       r('SN','en'), 'fr');
eq('Nigeria, French phone → English',       r('NG','fr'), 'en');
eq('Cameroon, English phone stays English', r('CM','en'), 'en');
eq('Cameroon, French phone stays French',   r('CM','fr'), 'fr');
eq('Cameroon, German phone → French default', r('CM','de'), 'fr');
eq('Madagascar → French (no Malagasy yet)', r('MG','en'), 'fr');
eq('Botswana → English',                    r('BW','fr'), 'en');
eq('DR Congo → French',                     r('CD','en'), 'fr');
eq('CAR → French',                          r('CF','en'), 'fr');
eq('Guinea-Bissau → Portuguese',            r('GW','en'), 'pt');
eq('Sierra Leone → English',                r('SL','fr'), 'en');
eq('Unknown region (US) uses phone lang',   r('US','es'), 'es');
eq('Unknown region + unsupported lang → en',r('US','sw'), 'en');
eq('No region info → phone language',       r(undefined,'fr'), 'fr');
eq('No signals at all → en',                r(undefined), 'en');
eq('lowercase region ok',                   r('ml','en'), 'fr');
eq('country whose language is unsupported → null', languageForCountry('ML','en',['en']), null);
// every Orange market the user listed must be known
for (const c of ['ML','CM','CI','SN','MG','BW','GN','GW','SL','CD','CF']) eq('known: '+c, c in COUNTRY_LANGUAGE, true);
process.exit(fail ? 1 : 0);
