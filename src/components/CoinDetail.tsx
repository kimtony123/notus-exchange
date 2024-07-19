import React from "react";
import { useParams } from "react-router-dom";
import useAxios from "../hooks/useAxios"; // Adjust the import path as necessary
import {
  Button,
  Header,
  Grid,
  Divider,
  Form,
  Segment,
  Image,
  Table,
  Message,
  Menu,
  MenuItem,
  FormGroup,
  FormButton,
  FormInput,
  MenuMenu,
  Container,
} from "semantic-ui-react";
import {
  TableHeader,
  TableRow,
  TableHeaderCell,
  TableBody,
  TableCell,
} from "semantic-ui-react";
import Skeleton from "./Skeleton"; // Adjust the import path as necessary
import { useEffect, useState } from "react";
import { message, createDataItemSigner, result } from "@permaweb/aoconnect";
import { PermissionType } from "arconnect";

// Define types for route parameters
type RouteParams = {
  id: string;
};
interface Tag {
  name: string;
  value: string;
}

type CoinResponse = {
  name: string;
  image: {
    small: string;
  };
  sentiment_votes_up_percentage: number;
  sentiment_votes_down_percentage: number;
  id: string;
  symbol: string;
  market_data: {
    current_price: {
      usd: number;
    };
  };
};

interface TradeDetails {
  UserId: string;
  TradeId: number;
  BetAmount: number;
  ContractType: string;
  Name: string;
  AssetPrice: string;
  ContractStatus: string;
  AssetId: string;
  ContractExpiry: string;
  CreatedTime: string;
  ClosingPrice: number;
  ClosingTime: number;
  Payout: number;
  Outcome: string;
}

interface Trade {
  TradeId: number;
  UserId: string;
  BetAmount: number;
  ContractType: string;
  Name: string;
  AssetPrice: string;
  ContractStatus: string;
  AssetId: string;
  ContractExpiry: string;
  CreatedTime: string;
  ClosingPrice: number;
  ClosingTime: number;
  Payout: number;
  Outcome: string;
}
// Time Decay Function
const timeDecay = (expiryMinutes: number) => {
  const decayFactor = Math.exp(-expiryMinutes / 525600); // assuming 60 minutes for full decay
  return decayFactor;
};

// Adjust Probability Function
const adjustProbability = (
  prob: number,
  spread: number = 0,
  expiryMinutes: number = 0
) => {
  // Apply a nonlinear transformation (e.g., exponential) to adjust probability
  const adjustedProb = Math.exp(prob / 100) / Math.exp(1);

  // Apply time decay
  const decayFactor = timeDecay(expiryMinutes);
  const timeAdjustedProb = adjustedProb * decayFactor;

  return timeAdjustedProb * (1 + spread);
};

// Define the CoinDetail component
const CoinDetail: React.FC = () => {
  const { id } = useParams<RouteParams>();
  const { response } = useAxios<CoinResponse>(`coins/${id}`);
  console.log(response);

  const permissions: PermissionType[] = [
    "ACCESS_ADDRESS",
    "SIGNATURE",
    "SIGN_TRANSACTION",
    "DISPATCH",
  ];

  const NOT = "HmOxNfr7ZCmT7hhx1LTO7765b-NGoT6lhha_ffjaCn4";

  const [aocBalance, setAocBalance] = useState(0);
  const [address, setAddress] = useState("");
  const [betAmountCall, setBetAmountCall] = useState("");
  const [betAmountPut, setBetAmountPut] = useState("");

  const [opentrades, setOpenTrades] = useState<Trade[]>([]);
  const [closedtrades, setClosedTrades] = useState<Trade[]>([]);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [oddsDown, setOddsDown] = useState<string>("");
  const [oddsUp, setOddsUp] = useState<string>("");
  const [expiryDayCall, setExpiryDayCall] = useState("");
  const [expiryDayPut, setExpiryDayPut] = useState("");
  const [isLoadingCall, setIsLoadingCall] = useState(false);
  const [isLoadingPut, setIsLoadingPut] = useState(false);
  const [isLoadingClaim, setIsLoadingClaim] = useState(false);
  const [responsemessage, setResponseMessage] = useState<string | null>(null);

  const [claimSuccess, setSuccess] = useState(false);

  useEffect(() => {
    calculatePayoffs();
  }, [betAmountCall, betAmountPut, expiryDayCall, expiryDayPut]);

  const calculatePayoffs = () => {
    if (!response) {
      setErrorMessage("Response data is missing.");
      return;
    }
    const sentimentVotesDownPercentage =
      response?.sentiment_votes_down_percentage!;
    const sentimentVotesUpPercentage = response?.sentiment_votes_up_percentage!;
    const expiryMinutesCall = expiryDayCall; // Get the expiry time in minutes from input
    const expiryMinutesPut = expiryDayPut; // Get the expiry time in minutes from input

    // Determine which side has the higher probability
    const isDownHigher =
      sentimentVotesDownPercentage > sentimentVotesUpPercentage;

    // Define the spread
    const totalSpread = 0.2;

    // Apply the spread split
    const lowerSpread = (2 / 3) * totalSpread;
    const higherSpread = (1 / 3) * totalSpread;

    const adjustedDownProbability = adjustProbability(
      sentimentVotesDownPercentage,
      isDownHigher ? higherSpread : lowerSpread,
      expiryMinutesPut
    );
    const adjustedUpProbability = adjustProbability(
      sentimentVotesUpPercentage,
      isDownHigher ? lowerSpread : higherSpread,
      expiryMinutesCall
    );

    // Normalize the probabilities to ensure they sum to 1
    const totalAdjustedProbability =
      adjustedDownProbability + adjustedUpProbability;
    const normalizedDownProbability =
      adjustedDownProbability / totalAdjustedProbability;
    const normalizedUpProbability =
      adjustedUpProbability / totalAdjustedProbability;

    // Calculate the odds
    setOddsDown((1 / normalizedDownProbability).toFixed(3));
    setOddsUp((1 / normalizedUpProbability).toFixed(3));
    setErrorMessage("");
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    switch (name) {
      case "betAmountCall":
        setBetAmountCall(value);
        break;
      case "betAmountPut":
        setBetAmountPut(value);
        break;
      case "expiryDayCall":
        setExpiryDayCall(value);
        break;
      case "expiryDayPut":
        setExpiryDayPut(value);
        break;
      default:
        break;
    }
  };

  const randomInt = (min: number, max: number): number => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  };

  const tradeCall = async () => {
    setIsLoadingCall(true);
    try {
      const getPropMessage = await message({
        process: NOT,
        tags: [
          { name: "Action", value: "trade" },
          { name: "TradeId", value: String(randomInt(1, 1000000000)) },
          { name: "Name", value: String(response?.name!) },
          { name: "AssetId", value: String(response?.symbol!) },
          {
            name: "AssetPrice",
            value: String(response?.market_data.current_price.usd),
          },
          { name: "CreatedTime", value: String(Date.now()) },
          { name: "ContractType", value: "Call" },
          { name: "ContractStatus", value: "Open" },
          {
            name: "ContractExpiry",
            value: String(expiryDayCall),
          },
          {
            name: "BetAmount",
            value: String(Number(betAmountCall) * 1000),
          },
          {
            name: "Payout",
            value: String(oddsUp),
          },
        ],
        signer: createDataItemSigner(window.arweaveWallet),
      });
      try {
        let { Messages, Error } = await result({
          message: getPropMessage,
          process: NOT,
        });
        if (Error) {
          alert("Error handling staking:" + Error);
          return;
        }
        if (!Messages || Messages.length === 0) {
          alert("No messages were returned from ao. Please try later.");
          return;
        }
        alert(Messages[0].Data);
        setBetAmountCall("");
        setExpiryDayCall("");
      } catch (error) {
        alert("There was an error when Buying: " + error);
      }
    } catch (error) {
      alert("There was an error staking: " + error);
    }
    setIsLoadingCall(false);
  };

  const randomIntPut = (min: number, max: number): number => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  };

  const tradePut = async () => {
    setIsLoadingPut(true);
    try {
      const getPropMessage = await message({
        process: NOT,
        tags: [
          { name: "Action", value: "trade" },
          { name: "TradeId", value: String(randomIntPut(1, 1000000000)) },
          { name: "Name", value: String(response?.name!) },
          { name: "AssetId", value: String(response?.symbol!) },
          {
            name: "AssetPrice",
            value: String(response?.market_data.current_price.usd),
          },
          { name: "CreatedTime", value: String(Date.now()) },
          { name: "ContractType", value: "Put" },
          { name: "ContractStatus", value: "Open" },
          {
            name: "ContractExpiry",
            value: String(expiryDayPut),
          },
          { name: "BetAmount", value: String(Number(betAmountPut) * 1000) },
          { name: "Payout", value: String(oddsDown) },
        ],
        signer: createDataItemSigner(window.arweaveWallet),
      });
      try {
        let { Messages, Error } = await result({
          message: getPropMessage,
          process: NOT,
        });
        if (Error) {
          alert("Error handling staking:" + Error);
          return;
        }
        if (!Messages || Messages.length === 0) {
          alert("No messages were returned from ao. Please try later.");
          return;
        }
        alert(Messages[0].Data);
        setBetAmountPut("");
        setExpiryDayPut("");
      } catch (error) {
        alert("There was an error when Buying: " + error);
      }
    } catch (error) {
      alert("There was an error staking: " + error);
    }
    setIsLoadingPut(false);
  };

  useEffect(() => {
    const fetchOpenTrades = async () => {
      try {
        const messageResponse = await message({
          process: NOT,
          tags: [{ name: "Action", value: "openTrades" }],
          signer: createDataItemSigner(window.arweaveWallet),
        });
        const getProposalsMessage = messageResponse;
        try {
          let { Messages, Error } = await result({
            message: getProposalsMessage,
            process: NOT,
          });
          if (Error) {
            alert("Error fetching proposals:" + Error);
            return;
          }
          if (!Messages || Messages.length === 0) {
            alert("No messages were returned from ao. Please try later.");
            return;
          }
          const data = JSON.parse(Messages[0].Data);
          const openTradesData = Object.entries(data).map(([name, details]) => {
            const typedDetails: TradeDetails = details as TradeDetails;
            return {
              name,
              BetAmount: typedDetails.BetAmount / 1000,
              ContractType: typedDetails.ContractType,
              Name: typedDetails.Name,
              AssetPrice: typedDetails.AssetPrice,
              ContractStatus: typedDetails.ContractStatus,
              AssetId: typedDetails.AssetId,
              ContractExpiry: typedDetails.ContractExpiry,
              TradeId: typedDetails.TradeId,
              CreatedTime: typedDetails.CreatedTime,
              ClosingTime: typedDetails.ClosingTime,
              ClosingPrice: typedDetails.ClosingPrice,
              Payout: typedDetails.Payout,
              UserId: typedDetails.UserId,
              Outcome: typedDetails.Outcome,
            };
          });
          setOpenTrades(openTradesData);
        } catch (error) {
          alert("There was an error when loading balances: " + error);
        }
      } catch (error) {
        console.error(error);
      }
    };
    fetchOpenTrades();
  }, []);

  useEffect(() => {
    const fetchClosedTrades = async () => {
      try {
        const messageResponse = await message({
          process: NOT,
          tags: [{ name: "Action", value: "closedTrades" }],
          signer: createDataItemSigner(window.arweaveWallet),
        });
        const getProposalsMessage = messageResponse;
        try {
          let { Messages, Error } = await result({
            message: getProposalsMessage,
            process: NOT,
          });
          if (Error) {
            alert("Error fetching proposals:" + Error);
            return;
          }
          if (!Messages || Messages.length === 0) {
            alert("No messages were returned from ao. Please try later.");
            return;
          }
          const data = JSON.parse(Messages[0].Data);
          const closedTradesData = Object.entries(data).map(
            ([name, details]) => {
              const typedDetails: TradeDetails = details as TradeDetails;
              return {
                name,
                BetAmount: typedDetails.BetAmount / 1000,
                ContractType: typedDetails.ContractType,
                Name: typedDetails.Name,
                AssetPrice: typedDetails.AssetPrice,
                ContractStatus: typedDetails.ContractStatus,
                AssetId: typedDetails.AssetId,
                ContractExpiry: typedDetails.ContractExpiry,
                TradeId: typedDetails.TradeId,
                CreatedTime: typedDetails.CreatedTime,
                ClosingTime: typedDetails.ClosingTime,
                ClosingPrice: typedDetails.ClosingPrice,
                Payout: typedDetails.Payout,
                UserId: typedDetails.UserId,
                Outcome: typedDetails.Outcome,
              };
            }
          );
          setClosedTrades(closedTradesData);
        } catch (error) {
          alert("There was an error when loading balances: " + error);
        }
      } catch (error) {
        console.error(error);
      }
    };
    fetchClosedTrades();
  }, []);

  useEffect(() => {
    const fetchBalance = async (process: string) => {
      try {
        const messageResponse = await message({
          process,
          tags: [{ name: "Action", value: "Balance" }],
          signer: createDataItemSigner(window.arweaveWallet),
        });
        const getBalanceMessage = messageResponse;
        try {
          let { Messages, Error } = await result({
            message: getBalanceMessage,
            process,
          });
          if (Error) {
            alert("Error fetching balances:" + Error);
            return;
          }
          if (!Messages || Messages.length === 0) {
            alert("No messages were returned from ao. Please try later.");
            return;
          }
          const balanceTag = Messages[0].Tags.find(
            (tag: Tag) => tag.name === "Balance"
          );
          const balance = balanceTag
            ? parseFloat((balanceTag.value / 1000).toFixed(4))
            : 0;
          if (process === NOT) {
            setAocBalance(balance);
          }
        } catch (error) {
          alert("There was an error when loading balances: " + error);
        }
      } catch (error) {
        console.error(error);
      }
    };
    fetchBalance(NOT);
  }, [address]);

  if (!response) {
    return (
      <div className="wrapper-container mt-8">
        <Skeleton className="h-8 w-32 mb-4" />
        <Skeleton className="h-72 w-full mb-10" />
      </div>
    );
  }

  return (
    <Container>
      <Menu pointing secondary>
        <MenuItem>
          <Form>
            <FormGroup>
              <FormInput type="number" size="mini" placeholder="Amount" />
              <FormButton secondary size="mini" content="Unstake." />
            </FormGroup>
          </Form>
        </MenuItem>
        <MenuMenu position="right">
          <MenuItem>
            <Form>
              <FormGroup>
                <FormInput type="number" size="mini" placeholder="Amount" />
                <FormButton size="mini" primary content="Stake." />
              </FormGroup>
            </Form>
          </MenuItem>
        </MenuMenu>
      </Menu>
      <Header as="h2" color="teal" textAlign="center">
        <Image src="/logox.png" alt="logo" /> Create a Trade.
      </Header>
      <Divider />
      <Grid columns="equal">
        <Divider />
        <Grid.Column>
          <Form size="large">
            <span> NOT Balance: {aocBalance}</span>
            <Segment stacked>
              <Image src={response.image.small} wrapped ui={false} />
              <span> Asset Name: {response.name}</span>
              <Divider />
              <span>Asset Id : {response.id}</span>
              <Divider />
              <span>
                Asset Price : {response.market_data.current_price.usd}
              </span>
              <Divider />
              <Form.Input
                type="number"
                name="betAmountCall"
                value={betAmountCall}
                onChange={handleInputChange}
                icon="money"
                iconPosition="left"
                placeholder="Amount of NOT."
              />
              <span>Minimum Trade time is 5 minutes</span>
              <Form.Input
                fluid
                name="expiryDayCall"
                icon="calendar alternate outline"
                iconPosition="left"
                placeholder="Expiry in Minutes"
                type="number"
                value={expiryDayCall}
                onChange={handleInputChange}
              />
              <Divider />
              <span>Payoff: {oddsUp}</span>
              <Button
                onClick={tradeCall}
                color="teal"
                fluid
                size="small"
                loading={isLoadingCall}
              >
                Call
              </Button>
            </Segment>
          </Form>
        </Grid.Column>
        <Grid.Column>
          <Form size="large">
            <span> Staked Balance: 0</span>
            <Segment stacked>
              <Image src={response.image.small} wrapped ui={false} />
              <span> Asset Name: {response.name}</span>
              <Divider />
              <span>Asset Id : {response.id}</span>
              <Divider />
              <span>
                Asset Price : {response.market_data.current_price.usd}
              </span>
              <Divider />
              <Form.Input
                type="number"
                name="betAmountPut"
                value={betAmountPut}
                onChange={handleInputChange}
                icon="money"
                iconPosition="left"
                placeholder="Amount of NOT."
              />
              <span>Minimum Trade time is 5 minutes</span>
              <Form.Input
                fluid
                name="expiryDayPut"
                icon="calendar alternate outline"
                iconPosition="left"
                placeholder="Expiry in Minutes"
                type="number"
                value={expiryDayPut}
                onChange={handleInputChange}
              />
              <Divider />
              <span>Payoff: {oddsDown}</span>
              <Button
                onClick={tradePut}
                color="red"
                fluid
                size="small"
                loading={isLoadingPut}
              >
                Put
              </Button>
            </Segment>
          </Form>
        </Grid.Column>
      </Grid>
      <Header as="h2" color="teal" textAlign="center">
        <Image src="/logox.png" alt="logo" /> Open Trades.
      </Header>
      <Table celled>
        <TableHeader>
          <TableRow>
            <TableHeaderCell>ProcessId</TableHeaderCell>
            <TableHeaderCell>Asset Name</TableHeaderCell>
            <TableHeaderCell>Asset Price</TableHeaderCell>
            <TableHeaderCell>Contract Type</TableHeaderCell>
            <TableHeaderCell>Trade Amount</TableHeaderCell>
            <TableHeaderCell>Created Time</TableHeaderCell>
            <TableHeaderCell>Contract Expiry</TableHeaderCell>
            <TableHeaderCell>Contract Status</TableHeaderCell>
            <TableHeaderCell>Closing Time</TableHeaderCell>
            <TableHeaderCell>Closing Price</TableHeaderCell>
            <TableHeaderCell>Payout</TableHeaderCell>
            <TableHeaderCell>Outcome</TableHeaderCell>
          </TableRow>
        </TableHeader>

        <TableBody>
          {opentrades.map((trade, index) => (
            <TableRow key={index}>
              <TableCell>{trade.UserId}</TableCell>
              <TableCell>{trade.Name}</TableCell>
              <TableCell>{trade.AssetPrice}</TableCell>
              <TableCell>{trade.ContractType}</TableCell>
              <TableCell>{trade.BetAmount}</TableCell>
              <TableCell>{trade.CreatedTime}</TableCell>
              <TableCell>{trade.ContractExpiry}</TableCell>
              <TableCell>{trade.ContractStatus}</TableCell>
              <TableCell>{trade.ClosingTime}</TableCell>
              <TableCell>{trade.ClosingPrice}</TableCell>
              <TableCell>{trade.Payout}</TableCell>
              <TableCell>{trade.Outcome}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Divider />
      <Header as="h2" color="teal" textAlign="center">
        <Image src="/logox.png" alt="logo" /> Closed Trades.
      </Header>
      <Table celled>
        <TableHeader>
          <TableRow>
            <TableHeaderCell>ProcessId</TableHeaderCell>
            <TableHeaderCell>Asset Name</TableHeaderCell>
            <TableHeaderCell>Asset Price</TableHeaderCell>
            <TableHeaderCell>Contract Type</TableHeaderCell>
            <TableHeaderCell>Trade Amount</TableHeaderCell>
            <TableHeaderCell>Created Time</TableHeaderCell>
            <TableHeaderCell>Contract Expiry</TableHeaderCell>
            <TableHeaderCell>Contract Status</TableHeaderCell>
            <TableHeaderCell>Closing Time</TableHeaderCell>
            <TableHeaderCell>Closing Price</TableHeaderCell>
            <TableHeaderCell>Payout</TableHeaderCell>
            <TableHeaderCell>Outcome</TableHeaderCell>
          </TableRow>
        </TableHeader>

        <TableBody>
          {closedtrades.map((trade, index) => (
            <TableRow key={index}>
              <TableCell>{trade.UserId}</TableCell>
              <TableCell>{trade.Name}</TableCell>
              <TableCell>{trade.AssetPrice}</TableCell>
              <TableCell>{trade.ContractType}</TableCell>
              <TableCell>{trade.BetAmount}</TableCell>
              <TableCell>{trade.CreatedTime}</TableCell>
              <TableCell>{trade.ContractExpiry}</TableCell>
              <TableCell>{trade.ContractStatus}</TableCell>
              <TableCell>{trade.ClosingTime}</TableCell>
              <TableCell>{trade.ClosingPrice}</TableCell>
              <TableCell>{trade.Payout}</TableCell>
              <TableCell>{trade.Outcome}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Divider />
      <Menu>
        <MenuItem href="https://notus-memeframe.vercel.app/" header>
          Notus DAO.
        </MenuItem>

        <MenuItem>
          <Button
            href="https://x.com/NotusOptions"
            content="Twitter."
            icon="twitter"
            labelPosition="right"
          />
        </MenuItem>
        <MenuItem position="right">
          <Button
            href="https://github.com/kimtony123/notus-trading-app"
            content="Github."
            icon="github"
            labelPosition="left"
          />
        </MenuItem>
      </Menu>
      {errorMessage && (
        <div style={{ color: "red", textAlign: "center" }}>{errorMessage}</div>
      )}
    </Container>
  );
};

export default CoinDetail;
