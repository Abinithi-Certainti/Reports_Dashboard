-- Mock of the OLD SQL Server tables (dbo), generated from the schema review. Test only.

GO
IF OBJECT_ID('dbo.[NetSuiteLocation_Mapping]') IS NOT NULL DROP TABLE dbo.[NetSuiteLocation_Mapping];
CREATE TABLE dbo.[NetSuiteLocation_Mapping] (
    [LocationID] int IDENTITY(1,1) NOT NULL,
    [PreAcquisition] varchar(255) NULL,
    [PostAcquisition] varchar(255) NULL,
    [AcquitsionDate] smalldatetime NULL,
    [Company] varchar(255) NULL,
    [Location] varchar(255) NULL,
    [LocationName] varchar(255) NULL,
    [Brand] varchar(255) NULL,
    [BrandName] varchar(255) NULL,
    [CTLocation] varchar(100) NULL,
    [CTBrand] varchar(100) NULL,
    [NSDeptID] int NULL,
    [ROLLOUT] varchar(50) NULL,
    [HostLocationID] int NULL,
    [GUID] varchar(150) NULL,
    [StoreID] varchar(50) NULL,
    [brand_w_DT] int NULL,
    [no_of_type] int NULL
);

GO
IF OBJECT_ID('dbo.[District_Directors]') IS NOT NULL DROP TABLE dbo.[District_Directors];
CREATE TABLE dbo.[District_Directors] (
    [Plaza] varchar(50) NULL,
    [District] varchar(50) NULL,
    [District_Director] varchar(100) NULL,
    [HostLocationID] int NULL
);

GO
IF OBJECT_ID('dbo.[date_table]') IS NOT NULL DROP TABLE dbo.[date_table];
CREATE TABLE dbo.[date_table] (
    [day_id] int NULL,
    [Date] date NULL,
    [Week] int NULL,
    [Month] int NULL,
    [Year] int NULL,
    [Day_of_Month] int NULL,
    [Day of_Week] int NULL,
    [Weekday] varchar(15) NULL,
    [Start_of_Week] date NULL,
    [End_of_Week] date NULL,
    [Retail_Week_of_Year] int NULL,
    [Retail_Period] int NULL,
    [Retail_Year] int NULL,
    [Retail_Period_Start_Date] date NULL,
    [Retail_Period_End_Date] date NULL
);

GO
IF OBJECT_ID('dbo.[WeeklyCogsProdNum]') IS NOT NULL DROP TABLE dbo.[WeeklyCogsProdNum];
CREATE TABLE dbo.[WeeklyCogsProdNum] (
    [WeeklyCogsProdNum_ID] int IDENTITY(1,1) NOT NULL,
    [product_name] nvarchar(100) NULL,
    [product_num] nvarchar(100) NULL,
    [category] nvarchar(100) NULL,
    [sub_category] nvarchar(100) NULL,
    [micro_category] nvarchar(100) NULL,
    [inv_unit] nvarchar(100) NULL
);

GO
IF OBJECT_ID('dbo.[Temp_DLH]') IS NOT NULL DROP TABLE dbo.[Temp_DLH];
CREATE TABLE dbo.[Temp_DLH] (
    [Plaza] nvarchar(50) NULL,
    [Brand] nvarchar(50) NULL,
    [DLH_Date] date NULL,
    [DLH] float NULL
);

GO
IF OBJECT_ID('dbo.[Sales_2026_UnPivot_New]') IS NOT NULL DROP TABLE dbo.[Sales_2026_UnPivot_New];
CREATE TABLE dbo.[Sales_2026_UnPivot_New] (
    [Region] nvarchar(50) NOT NULL,
    [Location] nvarchar(50) NOT NULL,
    [Brand] nvarchar(50) NOT NULL,
    [value] decimal(10,3) NULL,
    [TimePeriod] varchar(50) NULL,
    [TimePeriod_Date] date NOT NULL,
    [HostLocationID] smallint NOT NULL
);

GO
IF OBJECT_ID('dbo.[GM_2026_UnPivot_New]') IS NOT NULL DROP TABLE dbo.[GM_2026_UnPivot_New];
CREATE TABLE dbo.[GM_2026_UnPivot_New] (
    [Region] nvarchar(50) NOT NULL,
    [Location] nvarchar(50) NOT NULL,
    [Brand] nvarchar(50) NOT NULL,
    [value] float NULL,
    [TimePeriod] varchar(50) NULL,
    [TimePeriod_Date] date NOT NULL,
    [HostLocationID] smallint NOT NULL
);

GO
IF OBJECT_ID('dbo.[Transactions_2026_UnPivot_v2]') IS NOT NULL DROP TABLE dbo.[Transactions_2026_UnPivot_v2];
CREATE TABLE dbo.[Transactions_2026_UnPivot_v2] (
    [Region] nvarchar(50) NOT NULL,
    [Location] nvarchar(50) NOT NULL,
    [Brand] nvarchar(50) NOT NULL,
    [value] float NULL,
    [TimePeriod] date NOT NULL,
    [TimePeriod_Date] date NOT NULL,
    [HostLocationID] smallint NOT NULL
);

GO
IF OBJECT_ID('dbo.[DLH_2026_UnPivot_New]') IS NOT NULL DROP TABLE dbo.[DLH_2026_UnPivot_New];
CREATE TABLE dbo.[DLH_2026_UnPivot_New] (
    [Region] nvarchar(50) NOT NULL,
    [Location] nvarchar(50) NOT NULL,
    [Brand] nvarchar(50) NOT NULL,
    [value] float NULL,
    [TimePeriod] date NOT NULL,
    [TimePeriod_Date] date NOT NULL,
    [HostLocationID] smallint NOT NULL
);

GO
IF OBJECT_ID('dbo.[WeeklyCogs]') IS NOT NULL DROP TABLE dbo.[WeeklyCogs];
CREATE TABLE dbo.[WeeklyCogs] (
    [WeeklyCogs_ID] int IDENTITY(1,1) NOT NULL,
    [loc_code] nvarchar(100) NULL,
    [Start_Date] datetime NULL,
    [period] datetime NULL,
    [product_num] varchar(100) NULL,
    [unit_price] float NULL,
    [begin_quantity] float NULL,
    [begin_value] float NULL,
    [purchase_quantity] float NULL,
    [purchase_value] float NULL,
    [inv_adj_quantity] float NULL,
    [inv_adj_value] float NULL,
    [waste_quantity] float NULL,
    [waste_value] float NULL,
    [var_adj_quantity] float NULL,
    [var_adj_value] float NULL,
    [transfer_out_quantity] float NULL,
    [transfer_out_value] float NULL,
    [end_quantity] float NULL,
    [end_value] float NULL,
    [cogs] float NULL,
    [createdate] datetime NULL,
    [theo_depletion] float NULL,
    [theo_cost] float NULL
);

GO
IF OBJECT_ID('dbo.[EmployeePaySummaryV2]') IS NOT NULL DROP TABLE dbo.[EmployeePaySummaryV2];
CREATE TABLE dbo.[EmployeePaySummaryV2] (
    [EmployeeNumber] varchar(50) NULL,
    [EmployeeName] nvarchar(255) NULL,
    [PayDate] datetime NULL,
    [Location] nvarchar(255) NULL,
    [Department] nvarchar(255) NULL,
    [Job] nvarchar(255) NULL,
    [AuthorizedManager] nvarchar(255) NULL,
    [AuthorizedEmployee] nvarchar(255) NULL,
    [PayCode] nvarchar(255) NULL,
    [PayCategory] nvarchar(255) NULL,
    [Hours] float NULL,
    [Rounded_In_Out] nvarchar(255) NULL,
    [PayAmount] float NULL,
    [Retrieve_Date] datetime NULL
);

GO
IF OBJECT_ID('dbo.[POS_ORDERPAIDOUTS]') IS NOT NULL DROP TABLE dbo.[POS_ORDERPAIDOUTS];
CREATE TABLE dbo.[POS_ORDERPAIDOUTS] (
    [OrderDetailID] smallint NOT NULL,
    [OrderID] int NOT NULL,
    [MenuItemID] smallint NOT NULL,
    [MenuItemName] varchar(60) NULL,
    [EnteredTime] smalldatetime NULL,
    [OrderTypeName] varchar(100) NULL,
    [OrderType] smallint NULL,
    [FinishOn] smalldatetime NULL,
    [EndDay] smalldatetime NULL,
    [PaymentAmount] numeric(9,2) NULL,
    [GUID] varchar(100) NULL,
    [StoreId] varchar(20) NULL
);

GO
IF OBJECT_ID('dbo.[POS_ORDERS]') IS NOT NULL DROP TABLE dbo.[POS_ORDERS];
CREATE TABLE dbo.[POS_ORDERS] (
    [OrderID] int NOT NULL,
    [StartOn] smalldatetime NULL,
    [FinishOn] smalldatetime NULL,
    [OrderTypeName] varchar(100) NULL,
    [OrderType] smallint NULL,
    [Tax] numeric(9,2) NULL,
    [SubTotal] numeric(9,2) NULL,
    [GrandTotal] numeric(9,2) NULL,
    [Total] numeric(9,2) NULL,
    [Discount] numeric(9,2) NULL,
    [ComboSaved] numeric(9,2) NULL,
    [IsRefund] varchar(10) NULL,
    [Endday] smalldatetime NULL,
    [Gross] numeric(9,2) NULL,
    [Net] numeric(9,2) NULL,
    [ReceiptNumber] int NULL,
    [OrderNumberID] int NULL,
    [StartPerson] varchar(60) NULL,
    [ClosePerson] varchar(60) NULL,
    [StartPersonEmployeeID] int NULL,
    [ClosePersonEmployeeID] int NULL,
    [Third_Party_OrderID] varchar(60) NULL,
    [TargetComputer] varchar(60) NULL,
    [GUID] varchar(100) NULL,
    [StoreId] varchar(20) NULL
);

GO
IF OBJECT_ID('dbo.[POS_ORDERPAYMENTS]') IS NOT NULL DROP TABLE dbo.[POS_ORDERPAYMENTS];
CREATE TABLE dbo.[POS_ORDERPAYMENTS] (
    [OrderID] int NOT NULL,
    [FinishOn] smalldatetime NULL,
    [Endday] smalldatetime NULL,
    [PaymentTypeID] smallint NULL,
    [PaymentAmount] numeric(9,2) NULL,
    [Gratuity] numeric(9,2) NULL,
    [PennyRounded] numeric(9,2) NULL,
    [UsePennyRounding] varchar(10) NULL,
    [ExchangeRate] numeric(9,4) NULL,
    [PaymentTypeName] varchar(50) NULL,
    [GUID] varchar(100) NULL,
    [StoreId] varchar(20) NULL
);

GO
IF OBJECT_ID('dbo.[POS_ORDERDETAILS]') IS NOT NULL DROP TABLE dbo.[POS_ORDERDETAILS];
CREATE TABLE dbo.[POS_ORDERDETAILS] (
    [OrderDetailID] smallint NOT NULL,
    [OrderID] int NOT NULL,
    [MenuItemID] int NOT NULL,
    [MenuItemName] varchar(60) NULL,
    [KitchenName] varchar(60) NULL,
    [MenuItemType] varchar(10) NULL,
    [PLU] varchar(20) NULL,
    [Price] numeric(9,2) NULL,
    [Quantity] int NULL,
    [DepartmentID] int NULL,
    [DepartmentName] varchar(60) NULL,
    [DiscountID] int NULL,
    [DiscountValue] numeric(9,2) NULL,
    [Discountamount] numeric(9,2) NULL,
    [HasMods] varchar(10) NULL,
    [Sequence] int NULL,
    [EnteredTime] smalldatetime NULL,
    [TaxExemption] varchar(10) NULL,
    [TaxQuantity] numeric(9,2) NULL,
    [Deposit] varchar(10) NULL,
    [ValueAddedBasePrice] numeric(9,2) NULL,
    [ComboDiscountedPrice] numeric(9,2) NULL,
    [ALCPrice] numeric(9,2) NULL,
    [ALCMaxPrice] numeric(9,2) NULL,
    [ALCRemainingPrice] numeric(9,2) NULL,
    [PricingGroupPLU] varchar(60) NULL,
    [PricingGroupName] varchar(60) NULL,
    [UpgradeAmount] numeric(9,2) NULL,
    [ComboPercentBasedPrice] numeric(9,2) NULL,
    [ComboPercentBasedDiscountPrice] numeric(9,2) NULL,
    [OrderTypeName] varchar(100) NULL,
    [OrderType] smallint NULL,
    [FinishOn] smalldatetime NULL,
    [Endday] smalldatetime NULL,
    [DiscountType] varchar(60) NULL,
    [PriceBackUP] numeric(9,2) NULL,
    [MaxOrderDetailID] smallint NULL,
    [PersistentPLU] int NULL,
    [GUID] varchar(100) NULL,
    [StoreId] varchar(20) NULL
);

GO
