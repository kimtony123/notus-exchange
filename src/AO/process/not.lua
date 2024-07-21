local json = require("json")
local math = require("math")

_0RBIT = "BaMK1dfayo75s3q1ow6AO64UDpD9SEFbeE8xYrY2fyQ"
_0RBT_TOKEN = "BUhZLMwQ6yZHguLtJYA5lLUa9LQzLXMXRfaq9FVcPJc"

BASE_URL = "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false&locale=en"
FEE_AMOUNT = "1000000000000" -- 1 $0RBT

TOKEN_PRICES = TOKEN_PRICES or {}
Balances = Balances or {}

-- Credentials token
NOT = "HmOxNfr7ZCmT7hhx1LTO7765b-NGoT6lhha_ffjaCn4"

-- Credentials token
Owner  = "1J_5LXOiHRZQtOYYyjL7CpG-SdAXMVtwkcsYo7-ky40"

-- Table to track addresses that have requested tokens
RequestedAddresses = RequestedAddresses or {}

openTrades = openTrades or {}
expiredTrades = expiredTrades or {}
closedTrades = closedTrades or {}
winners = winners or {}
ArchivedTrades = ArchivedTrades or {}
WinnersList = WinnersList or {}

-- Callback function for fetch price
fetchPriceCallback = nil

function fetchPrice(callback)
    local url = BASE_URL

    Send({
        Target = _0RBT_TOKEN,
        Action = "Transfer",
        Recipient = _0RBIT,
        Quantity = FEE_AMOUNT,
        ["X-Url"] = url,
        ["X-Action"] = "Get-Real-Data"
    })

    print("GET Request sent to the 0rbit process.")

    -- Save the callback to be called later
    fetchPriceCallback = callback
end

function receiveData(msg)
    local res = json.decode(msg.Data)

    for i, coin in ipairs(res) do
        TOKEN_PRICES[coin.symbol] = {
            id = coin.id,
            name = coin.name,
            symbol = coin.symbol,
            current_price = coin.current_price
        }
    end

    -- Printing the filtered data for verification
    for symbol, coin in pairs(TOKEN_PRICES) do
        print("ID: " .. coin.id .. ", Name: " .. coin.name .. ", Symbol: " .. coin.symbol .. ", Current Price: " .. coin.current_price)
    end

    -- Call the callback if it exists
    if fetchPriceCallback then
        fetchPriceCallback()
        fetchPriceCallback = nil -- Clear the callback after calling
    end
end

function getTokenPrice(token)
    local token_data = TOKEN_PRICES[token]

    if not token_data or not token_data.current_price then
        return nil
    else
        return token_data.current_price
    end
end

function tableToJson(tbl)
    local result = {}
    for key, value in pairs(tbl) do
        local valueType = type(value)
        if valueType == "table" then
            value = tableToJson(value)
            table.insert(result, string.format('"%s":%s', key, value))
        elseif valueType == "string" then
            table.insert(result, string.format('"%s":"%s"', key, value))
        elseif valueType == "number" then
            table.insert(result, string.format('"%s":%d', key, value))
        elseif valueType == "function" then
            table.insert(result, string.format('"%s":"%s"', key, tostring(value)))
        end
    end

    local json = "{" .. table.concat(result, ",") .. "}"
    return json
end

-- Function to check if the trade is a winner
function checkTradeWinner(trade, closingPrice)
    local winner = false
    if trade.ContractType == "Call" and closingPrice > tonumber(trade.AssetPrice) then
        winner = true
    elseif trade.ContractType == "Put" and closingPrice < tonumber(trade.AssetPrice) then
        winner = true
    end
    return winner
end

function sendRewards()
    for _, winner in pairs(winners) do
        if winner.Payout then
            local payout = winner.Payout * winner.BetAmount
            ao.send({
                Target = NOT,
                Action = "Transfer",
                Quantity = tostring(payout),
                Recipient = tostring(winner.UserId)
            })
            -- Ensure Balances[winner.UserId] is initialized to 0 if it's nil
            Balances[winner.UserId] = (Balances[winner.UserId] or 0) + payout
            print("Transferred: " .. payout .. " successfully to " .. winner.UserId)

            -- Update the trade outcome to "won"
            expiredTrades[winner.TradeId].Outcome = "won"
            closedTrades[winner.TradeId] = expiredTrades[winner.TradeId]
            expiredTrades[winner.TradeId] = nil
        else
            print("Skipping reward for winner with nil Payout.")
        end
    end

    -- Update the outcome of non-winners to "lost"
    for tradeId, trade in pairs(expiredTrades) do
        if not trade.Outcome then
            trade.Outcome = "lost"
            closedTrades[tradeId] = trade
        end
    end

    -- Clear winners and expiredTrades lists after sending rewards
    winners = {}
    expiredTrades = {}
end

-- Check Expired Contracts Handler Function
function checkExpiredContracts(msg)
    currentTime = tonumber(msg.Timestamp)
    print(currentTime)
    for tradeId, trade in pairs(openTrades) do
        local contractExp = tonumber(trade.ContractExpiry)
        if currentTime >= contractExp then
            trade.ContractStatus = "Expired"
            expiredTrades[tradeId] = trade
            openTrades[tradeId] = nil
        end
    end
end

function processExpiredContracts(msg)
    currentTime = tonumber(msg.Timestamp)
    print("Starting to process expired contracts at time:", currentTime)

    -- Check if the expiredTrades list is empty and exit early if it is
    if next(expiredTrades) == nil then
        print("No expired trades to process.")
        return
    end

    -- Define the callback to process expired trades after fetching prices
    local function processTrades()
        for tradeId, trade in pairs(expiredTrades) do
            print("Processing tradeId:", tradeId)
            fetchPrice()
            local closingPrice = getTokenPrice(trade.AssetId)
            if closingPrice then
                trade.ClosingPrice = closingPrice
                trade.ClosingTime = currentTime
                print("Updated trade:", tradeId, "with ClosingPrice:", closingPrice, "and ClosingTime:", currentTime)
                -- Check if the trade is a winner
                if checkTradeWinner(trade, closingPrice) then
                    winners[tradeId] = trade
                else
                    trade.Outcome = "lost"
                    closedTrades[tradeId] = trade
                end
            else
                print("Error: No closing price found for trade:", tradeId, "with AssetId:", trade.AssetId)
                trade.Outcome = "lost"
                closedTrades[tradeId] = trade
            end

            if not trade.ClosingPrice then -- Add check for nil value
                print("Skipping tradeId:", tradeId, "due to nil ClosingPrice.")
            end
        end
    end

    processTrades()
    sendRewards()
end

function archiveClosedTrades()
    if #closedTrades > 10 then
        for tradeId, trade in pairs(closedTrades) do
            ArchivedTrades[tradeId] = trade
        end
        closedTrades = {}
        print("Archived closed trades")
    end
end

function archiveWinners()
    if #winners > 10 then
        for tradeId, trade in pairs(winners) do
            WinnersList[tradeId] = trade
        end
        winners = {}
        print("Archived winners")
    end
end

Handlers.add(
    "GetTokenPrice",
    Handlers.utils.hasMatchingTag("Action", "Get-Token-Price"),
    function(m)
        local token = m.Tags.Token
        local current_price = getTokenPrice(token)

        if not current_price then
            Handlers.utils.reply("Price not available!!!")(m)
        else
            Handlers.utils.reply("Current Price: " .. tostring(current_price))(m)
        end
    end
)

Handlers.add(
    "FetchPrice",
    Handlers.utils.hasMatchingTag("Action", "Fetch-Price"),
    function(m)
        fetchPrice(m)
    end
)

Handlers.add(
    "reward",
    Handlers.utils.hasMatchingTag("Action", "reward"),
    sendRewards
)

Handlers.add(
    "ReceiveData",
    Handlers.utils.hasMatchingTag("Action", "Receive-Response"),
    receiveData
)

Handlers.add(
    "completeTrade",
    Handlers.utils.hasMatchingTag("Action", "Complete-Trade"),
    processExpiredContracts
)

Handlers.add(
    "checkExpiredContracts",
    Handlers.utils.hasMatchingTag("Action", "Check-Expired-Contracts"),
    checkExpiredContracts
)

Handlers.add(
    "archiveClosedTrades",
    Handlers.utils.hasMatchingTag("Action", "Archive-Closed-Trades"),
    archiveClosedTrades
)

Handlers.add(
    "archiveWinners",
    Handlers.utils.hasMatchingTag("Action", "Archive-Winners"),
    archiveWinners
)



Handlers.add(
  "CronTick", -- handler name
  Handlers.utils.hasMatchingTag("Action", "cron"), -- handler pattern to identify cron message
    function(m)
        print("CronTick handler triggered.")
        checkExpiredContracts(m)
        processExpiredContracts(m)
        archiveClosedTrades(m)
        archiveWinners(m)
    end
)