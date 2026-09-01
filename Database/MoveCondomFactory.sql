-- Move Pharmacare employees who belong to Condom Factory, setting JobTitle to their section
-- Match by IdNumber where available, else by name

-- ===== LAB =====
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='Lab', Department='Pharmacare' WHERE Site='Pharmacare' AND LastName LIKE '%Zamba%' AND FirstName LIKE '%Ladmillah%';
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='Lab', Department='Pharmacare' WHERE Site='Pharmacare' AND IdNumber='9107071239085'; -- Laurinda Masinga
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='Lab', Department='Pharmacare' WHERE Site='Pharmacare' AND IdNumber='9006250992086'; -- Lihle Mthembu (close match)
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='Lab', Department='Pharmacare' WHERE Site='Pharmacare' AND LastName LIKE '%Mngomezulu%' AND FirstName LIKE '%Non%';
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='Lab', Department='Pharmacare' WHERE Site='Pharmacare' AND IdNumber='9812140364083'; -- Precious Mhlongo
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='Lab', Department='Pharmacare' WHERE Site='Pharmacare' AND IdNumber='8805181047089'; -- Silindile Chamane
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='Lab', Department='Pharmacare' WHERE Site='Pharmacare' AND LastName LIKE '%Hadebe%' AND FirstName LIKE '%Sinen%';
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='Lab', Department='Pharmacare' WHERE Site='Pharmacare' AND IdNumber='0604221040081'; -- Nozibusiso Gumede
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='Lab', Department='Pharmacare' WHERE Site='Pharmacare' AND IdNumber='0209240900081'; -- Samukelisiwe Ngwane
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='Lab', Department='Pharmacare' WHERE Site='Pharmacare' AND LastName LIKE '%Shabalala%' AND FirstName LIKE '%Samuk%';
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='Lab', Department='Pharmacare' WHERE Site='Pharmacare' AND IdNumber='0208191145084'; -- Nqobile Mthembu
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='Lab', Department='Pharmacare' WHERE Site='Pharmacare' AND LastName LIKE '%Meyiwa%' AND FirstName LIKE '%Phen%';

-- ===== DIPPING =====
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='Dipping', Department='Pharmacare' WHERE Site='Pharmacare' AND IdNumber='0303075817088'; -- Bonga Dlamini
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='Dipping', Department='Pharmacare' WHERE Site='Pharmacare' AND IdNumber='8704025640086'; -- Ndumiso Ndimande
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='Dipping', Department='Pharmacare' WHERE Site='Pharmacare' AND LastName LIKE '%Ntakana%' AND FirstName LIKE '%Philas%';
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='Dipping', Department='Pharmacare' WHERE Site='Pharmacare' AND LastName LIKE '%Xulu%' AND FirstName LIKE '%Ntando%';
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='Dipping', Department='Pharmacare' WHERE Site='Pharmacare' AND LastName LIKE '%Mbatha%' AND FirstName LIKE '%Ntok%';
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='Dipping', Department='Pharmacare' WHERE Site='Pharmacare' AND LastName LIKE '%Mzobe%' AND FirstName LIKE '%Siph%';
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='Dipping', Department='Pharmacare' WHERE Site='Pharmacare' AND LastName LIKE '%Mgumbeza%' AND FirstName LIKE '%Siyanda%';
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='Dipping', Department='Pharmacare' WHERE Site='Pharmacare' AND LastName LIKE '%Mncwango%' AND FirstName LIKE '%Themb%';
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='Dipping', Department='Pharmacare' WHERE Site='Pharmacare' AND LastName LIKE '%Gcaba%' AND FirstName LIKE '%Hlang%';

-- ===== FOILING =====
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='Foiling', Department='Pharmacare' WHERE Site='Pharmacare' AND LastName LIKE '%Maphumulo%' AND FirstName LIKE '%Slindile%';
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='Foiling', Department='Pharmacare' WHERE Site='Pharmacare' AND LastName LIKE '%Xaba%' AND FirstName LIKE '%Thandaz%';
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='Foiling', Department='Pharmacare' WHERE Site='Pharmacare' AND IdNumber='8505221151087'; -- Nompumelelo Goba
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='Foiling', Department='Pharmacare' WHERE Site='Pharmacare' AND LastName LIKE '%Nxumalo%' AND FirstName LIKE '%Nompum%';
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='Foiling', Department='Pharmacare' WHERE Site='Pharmacare' AND LastName LIKE '%Mhlongo%' AND FirstName LIKE '%Bongek%';
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='Foiling', Department='Pharmacare' WHERE Site='Pharmacare' AND LastName LIKE '%Ndlovu%' AND FirstName LIKE '%Philile%';
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='Foiling', Department='Pharmacare' WHERE Site='Pharmacare' AND IdNumber='0208270676082'; -- Nosiphiwo Lushaba
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='Foiling', Department='Pharmacare' WHERE Site='Pharmacare' AND LastName LIKE '%Mbatha%' AND FirstName LIKE '%Hlangan%';
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='Foiling', Department='Pharmacare' WHERE Site='Pharmacare' AND LastName LIKE '%Mhlongo%' AND FirstName LIKE '%Jabul%';
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='Foiling', Department='Pharmacare' WHERE Site='Pharmacare' AND IdNumber='9604261077085'; -- Nompumelelo Zondi
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='Foiling', Department='Pharmacare' WHERE Site='Pharmacare' AND LastName LIKE '%Ngcobo%' AND FirstName LIKE '%Nonjab%';
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='Foiling', Department='Pharmacare' WHERE Site='Pharmacare' AND LastName LIKE '%Magobidladla%';
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='Foiling', Department='Pharmacare' WHERE Site='Pharmacare' AND LastName LIKE '%Ngiba%' AND FirstName LIKE '%Zamok%';
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='Foiling', Department='Pharmacare' WHERE Site='Pharmacare' AND LastName LIKE '%Tshanini%';
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='Foiling', Department='Pharmacare' WHERE Site='Pharmacare' AND LastName LIKE '%Zungu%' AND FirstName LIKE '%Thobek%';
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='Foiling', Department='Pharmacare' WHERE Site='Pharmacare' AND LastName LIKE '%Nsindane%' OR (Site='Pharmacare' AND LastName LIKE '%Ncindane%' AND FirstName LIKE '%Thab%');
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='Foiling', Department='Pharmacare' WHERE Site='Pharmacare' AND LastName LIKE '%Mkhize%' AND FirstName LIKE '%Samuk%';
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='Foiling', Department='Pharmacare' WHERE Site='Pharmacare' AND LastName LIKE '%Dlamini%' AND FirstName LIKE '%Balon%';

-- ===== ET =====
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='ET', Department='Pharmacare' WHERE Site='Pharmacare' AND LastName LIKE '%Mthembu%' AND FirstName LIKE '%Snenhl%';
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='ET', Department='Pharmacare' WHERE Site='Pharmacare' AND LastName LIKE '%Magwaza%' AND FirstName LIKE '%Lihleth%';
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='ET', Department='Pharmacare' WHERE Site='Pharmacare' AND IdNumber='9408201049083'; -- Nomvula Shandu
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='ET', Department='Pharmacare' WHERE Site='Pharmacare' AND LastName LIKE '%Mhlongo%' AND FirstName LIKE '%Silindok%';
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='ET', Department='Pharmacare' WHERE Site='Pharmacare' AND LastName LIKE '%Sibiya%' AND FirstName LIKE '%Noxolo%';
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='ET', Department='Pharmacare' WHERE Site='Pharmacare' AND LastName LIKE '%Nzinzwa%';
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='ET', Department='Pharmacare' WHERE Site='Pharmacare' AND IdNumber='8708071031082'; -- Bongiwe Mbambo
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='ET', Department='Pharmacare' WHERE Site='Pharmacare' AND IdNumber='9209041368083'; -- Snethemba Mpungose
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='ET', Department='Pharmacare' WHERE Site='Pharmacare' AND LastName LIKE '%Matshonisa%';
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='ET', Department='Pharmacare' WHERE Site='Pharmacare' AND LastName LIKE '%Mdondolo%';
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='ET', Department='Pharmacare' WHERE Site='Pharmacare' AND LastName LIKE '%Makhanya%' AND FirstName LIKE '%Nokup%';
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='ET', Department='Pharmacare' WHERE Site='Pharmacare' AND IdNumber='0208101233087'; -- Esethu Vulizibaya
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='ET', Department='Pharmacare' WHERE Site='Pharmacare' AND LastName LIKE '%Masiko%' AND FirstName LIKE '%Nontok%';
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='ET', Department='Pharmacare' WHERE Site='Pharmacare' AND IdNumber='0202150748087'; -- Nosipho Mnguni
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='ET', Department='Pharmacare' WHERE Site='Pharmacare' AND LastName LIKE '%Makhathini%' AND FirstName LIKE '%Noxolo%';
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='ET', Department='Pharmacare' WHERE Site='Pharmacare' AND LastName LIKE '%Ngubane%' AND FirstName LIKE '%Owethu%';
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='ET', Department='Pharmacare' WHERE Site='Pharmacare' AND LastName LIKE '%Mathetha%';
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='ET', Department='Pharmacare' WHERE Site='Pharmacare' AND LastName LIKE '%Mthembu%' AND FirstName LIKE '%Sinoth%';
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='ET', Department='Pharmacare' WHERE Site='Pharmacare' AND LastName LIKE '%Khubone%';
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='ET', Department='Pharmacare' WHERE Site='Pharmacare' AND LastName LIKE '%Tembe%' AND FirstName LIKE '%Thobil%';
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='ET', Department='Pharmacare' WHERE Site='Pharmacare' AND LastName LIKE '%Mnguni%' AND FirstName LIKE '%Phindile%';
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='ET', Department='Pharmacare' WHERE Site='Pharmacare' AND LastName LIKE '%Nsele%' AND FirstName LIKE '%Slindile%';
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='ET', Department='Pharmacare' WHERE Site='Pharmacare' AND LastName LIKE '%Sthole%' OR (Site='Pharmacare' AND LastName LIKE '%Sithole%' AND FirstName LIKE '%Londiwe%');
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='ET', Department='Pharmacare' WHERE Site='Pharmacare' AND LastName LIKE '%Ngcobo%' AND FirstName LIKE '%Lihle%';
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='ET', Department='Pharmacare' WHERE Site='Pharmacare' AND LastName LIKE '%Nsele%' AND FirstName LIKE '%Nondumiso%';
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='ET', Department='Pharmacare' WHERE Site='Pharmacare' AND LastName LIKE '%Shabalala%' AND FirstName LIKE '%Gugul%';
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='ET', Department='Pharmacare' WHERE Site='Pharmacare' AND LastName LIKE '%Sibeko%' AND FirstName LIKE '%Sibon%';
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='ET', Department='Pharmacare' WHERE Site='Pharmacare' AND LastName LIKE '%Maphumulo%' AND FirstName LIKE '%Zinhle%';

-- ===== MAINTENANCE =====
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='Maintenance', Department='Pharmacare' WHERE Site='Pharmacare' AND LastName LIKE '%Magwaza%' AND FirstName LIKE '%Lungis%';
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='Maintenance', Department='Pharmacare' WHERE Site='Pharmacare' AND IdNumber='9511016210087'; -- Kwazimpilo Manqele
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='Maintenance', Department='Pharmacare' WHERE Site='Pharmacare' AND LastName LIKE '%Mngoma%' AND FirstName LIKE '%Nkul%';
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='Maintenance', Department='Pharmacare' WHERE Site='Pharmacare' AND LastName LIKE '%Rampersad%' AND FirstName LIKE '%Deshan%';
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='Maintenance', Department='Pharmacare' WHERE Site='Pharmacare' AND LastName LIKE '%Ngcobo%' AND FirstName LIKE '%Vukile%';

-- ===== CLEANER =====
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='Cleaner', Department='Pharmacare' WHERE Site='Pharmacare' AND LastName LIKE '%Duma%' AND FirstName LIKE '%Sizak%';

-- ===== PACKAGING =====
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='Packaging', Department='Pharmacare' WHERE Site='Pharmacare' AND LastName LIKE '%Mphahlele%' AND FirstName LIKE '%Makini%';
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='Packaging', Department='Pharmacare' WHERE Site='Pharmacare' AND LastName LIKE '%Mhlongo%' AND FirstName LIKE '%Dumisile%';
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='Packaging', Department='Pharmacare' WHERE Site='Pharmacare' AND LastName LIKE '%Maphumulo%' AND FirstName LIKE '%Sno%';
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='Packaging', Department='Pharmacare' WHERE Site='Pharmacare' AND LastName LIKE '%Masinga%' AND FirstName LIKE '%Eunice%';
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='Packaging', Department='Pharmacare' WHERE Site='Pharmacare' AND LastName LIKE '%Mkhize%' AND FirstName LIKE '%Mabusi%';
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='Packaging', Department='Pharmacare' WHERE Site='Pharmacare' AND LastName LIKE '%Mpanza%' AND FirstName LIKE '%Mandisa%';
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='Packaging', Department='Pharmacare' WHERE Site='Pharmacare' AND LastName LIKE '%Maziyana%';
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='Packaging', Department='Pharmacare' WHERE Site='Pharmacare' AND LastName LIKE '%Makhathini%' AND FirstName LIKE '%Msizi%';
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='Packaging', Department='Pharmacare' WHERE Site='Pharmacare' AND LastName LIKE '%Shibe%' AND FirstName LIKE '%Mzwand%';
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='Packaging', Department='Pharmacare' WHERE Site='Pharmacare' AND LastName LIKE '%Malinga%' AND FirstName LIKE '%Nobuhle%';
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='Packaging', Department='Pharmacare' WHERE Site='Pharmacare' AND LastName LIKE '%Ngcobo%' AND FirstName LIKE '%Nokuphiwa%';
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='Packaging', Department='Pharmacare' WHERE Site='Pharmacare' AND LastName LIKE '%Ndlovu%' AND FirstName LIKE '%Lungi%';
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='Packaging', Department='Pharmacare' WHERE Site='Pharmacare' AND LastName LIKE '%Buthelezi%' AND FirstName LIKE '%Phindile%';
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='Packaging', Department='Pharmacare' WHERE Site='Pharmacare' AND LastName LIKE '%Ndlovu%' AND FirstName LIKE '%Thobile%';
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='Packaging', Department='Pharmacare' WHERE Site='Pharmacare' AND LastName LIKE '%Nduli%';
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='Packaging', Department='Pharmacare' WHERE Site='Pharmacare' AND LastName LIKE '%Majola%' AND FirstName LIKE '%Witness%';
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='Packaging', Department='Pharmacare' WHERE Site='Pharmacare' AND LastName LIKE '%Khuzwayo%' AND FirstName LIKE '%Bongeka%';
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='Packaging', Department='Pharmacare' WHERE Site='Pharmacare' AND LastName LIKE '%Ngidi%' AND FirstName LIKE '%Nompum%';
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='Packaging', Department='Pharmacare' WHERE Site='Pharmacare' AND LastName LIKE '%Mkhize%' AND FirstName LIKE '%Thembe%';
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='Packaging', Department='Pharmacare' WHERE Site='Pharmacare' AND LastName LIKE '%Smangele%' OR (Site='Pharmacare' AND LastName LIKE '%Maphumulo%' AND FirstName LIKE '%Dagerec%');
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='Packaging', Department='Pharmacare' WHERE Site='Pharmacare' AND LastName LIKE '%Manzini%' AND FirstName LIKE '%Happy%';
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='Packaging', Department='Pharmacare' WHERE Site='Pharmacare' AND LastName LIKE '%Nyaba%' AND FirstName LIKE '%Dumis%';
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='Packaging', Department='Pharmacare' WHERE Site='Pharmacare' AND LastName LIKE '%Khanyile%' AND FirstName LIKE '%Ntomb%';
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='Packaging', Department='Pharmacare' WHERE Site='Pharmacare' AND LastName LIKE '%Chonco%' OR (Site='Pharmacare' AND LastName LIKE '%Majola%' AND FirstName LIKE '%Zandile%');
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='Packaging', Department='Pharmacare' WHERE Site='Pharmacare' AND LastName LIKE '%Simamane%' OR (Site='Pharmacare' AND LastName LIKE '%Smamane%');
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='Packaging', Department='Pharmacare' WHERE Site='Pharmacare' AND LastName LIKE '%Ntleko%';

-- ===== ADMIN =====
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='Admin', Department='Pharmacare' WHERE Site='Pharmacare' AND LastName LIKE '%Ashnika%' OR (Site='Pharmacare' AND LastName LIKE '%Vagrajh%');
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='Admin', Department='Pharmacare' WHERE Site='Pharmacare' AND LastName LIKE '%Zungu%' AND FirstName LIKE '%Lethok%';
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='Admin', Department='Pharmacare' WHERE Site='Pharmacare' AND LastName LIKE '%Naidoo%' AND FirstName LIKE '%Oseel%';
UPDATE HrEmployees SET Site='Condom Factory', JobTitle='Admin', Department='Pharmacare' WHERE Site='Pharmacare' AND LastName LIKE '%Zulu%' AND FirstName LIKE '%Thembi%';

-- Count moved
SELECT 'Moved to Condom Factory' AS Status, COUNT(*) AS Cnt FROM HrEmployees WHERE Site='Condom Factory';
