pragma solidity ^0.4.11;

contract PredictionMarket
{
    enum Vote { None, Yes, No }

    struct Bet {
        address bettor;
        Vote vote;
        uint amount;
        bool withdrawn;
    }

    struct Question {
        bool exists;

        string question;
        uint betDeadlineBlock;
        uint voteDeadlineBlock;

        uint yesVotes;
        uint noVotes;
        uint yesFunds;
        uint noFunds;

        mapping(address => Bet) bets;
        mapping(address => Vote) votes;
    }

    mapping(address => bool) public isAdmin;
    mapping(address => bool) public isTrustedSource;

    mapping(bytes32 => Question) public questionsByID;
    bytes32[] public questionIDs;

    uint constant DECIMALS = 18;

    event LogAddQuestion(address whoAdded, bytes32 questionID, string question, uint betDeadlineBlock, uint voteDeadlineBlock);
    event LogAddTrustedSource(address whoAdded, address trustedSource);
    event LogBet(address bettor, bytes32 questionID, Vote vote, uint betAmount);
    event LogVote(address trustedSource, bytes32 questionID, Vote vote);
    event LogWithdraw(address who, bytes32 questionID, uint amount);

    function PredictionMarket(address[] admins) {
        // require(admins.length > 0);

        for (uint i = 0; i < admins.length; i++) {
            isAdmin[admins[i]] = true;
        }
    }

    function addTrustedSource(address source)
        onlyAdmin
        returns (bool ok)
    {
        require(isTrustedSource[source] == false);

        isTrustedSource[source] = true;

        LogAddTrustedSource(msg.sender, source);
        return true;
    }

    function addQuestion(string question, uint betDeadlineBlock, uint voteDeadlineBlock)
        onlyAdmin
        returns (bool ok, bytes32 questionID)
    {
        require(betDeadlineBlock > block.number);
        require(voteDeadlineBlock > betDeadlineBlock);

        questionID = keccak256(question);

        require(questionsByID[questionID].exists == false);

        questionsByID[questionID] = Question({
            question: question,
            betDeadlineBlock: betDeadlineBlock,
            voteDeadlineBlock: voteDeadlineBlock,
            exists: true,
            yesFunds: 0,
            noFunds: 0,
            yesVotes: 0,
            noVotes: 0
        });

        questionIDs.push(questionID);

        LogAddQuestion(msg.sender, questionID, question, betDeadlineBlock, voteDeadlineBlock);

        return (true, questionID);
    }

    function bet(bytes32 questionID, bool vote)
        payable
        returns (bool ok)
    {
        require(msg.value > 0);

        Question storage question = questionsByID[questionID];

        require(question.exists);
        require(block.number <= question.betDeadlineBlock);

        Vote betVote;
        if (vote == true) {
            question.yesFunds += msg.value;
            betVote = Vote.Yes;
        } else {
            question.noFunds += msg.value;
            betVote = Vote.No;
        }

        question.bets[msg.sender] = Bet({
            bettor: msg.sender,
            vote: betVote,
            amount: msg.value,
            withdrawn: false
        });

        LogBet(msg.sender, questionID, betVote, msg.value);

        return true;
    }

    function vote(bytes32 questionID, bool yesOrNo)
        onlyTrustedSource
        returns (bool ok)
    {
        Question storage question = questionsByID[questionID];

        require(question.exists);
        require(block.number > question.betDeadlineBlock);
        require(block.number <= question.voteDeadlineBlock);
        require(question.votes[msg.sender] == Vote.None);

        Vote vote;
        if (yesOrNo == true) {
            question.yesVotes++;
            vote = Vote.Yes;
        } else {
            question.noVotes++;
            vote = Vote.No;
        }

        question.votes[msg.sender] = vote;

        LogVote(msg.sender, questionID, vote);

        return true;
    }

    function withdraw(bytes32 questionID)
        returns (bool ok)
    {
        Question storage question = questionsByID[questionID];
        require(question.exists);
        require(block.number > question.voteDeadlineBlock);

        Bet storage bet = question.bets[msg.sender];
        require(bet.amount > 0);
        require(bet.withdrawn == false);

        bet.withdrawn = true;

        // if nobody voted, or the vote was a tie, the bettors are allowed to simply withdraw their bets
        if (question.yesVotes == question.noVotes) {
            msg.sender.transfer(bet.amount);

            LogWithdraw(msg.sender, questionID, bet.amount);
            return true;
        }

        uint winningVoteFunds;
        if (question.yesVotes > question.noVotes) {
            require(bet.vote == Vote.Yes);
            winningVoteFunds = question.yesFunds;
        } else if (question.noVotes > question.yesVotes) {
            require(bet.vote == Vote.No);
            winningVoteFunds = question.noFunds;
        }

        uint totalFunds = question.yesFunds + question.noFunds;
        uint withdrawAmount = unfix(totalFunds * (fix(bet.amount, 18) / winningVoteFunds), 18);

        msg.sender.transfer(withdrawAmount);

        LogWithdraw(msg.sender, questionID, withdrawAmount);
        return true;
    }

    function numQuestions() constant returns (uint) {
        return questionIDs.length;
    }

    function getBet(bytes32 questionID, address bettor)
        public
        constant
        returns (Vote vote, uint amount, bool withdrawn)
    {
        Question storage question = questionsByID[questionID];
        require(question.exists);

        Bet storage bet = question.bets[bettor];
        return (bet.vote, bet.amount, bet.withdrawn);
    }

    function getVote(bytes32 questionID, address trustedSource)
        public
        constant
        returns (Vote vote)
    {
        Question storage question = questionsByID[questionID];
        require(question.exists);

        return question.votes[trustedSource];
    }

    function fix(uint n, uint x) private constant returns (uint) {
        return n * 10**x;
    }

    function unfix(uint n, uint x) private constant returns (uint) {
        return n / 10**x;
    }

    modifier onlyAdmin {
        require(isAdmin[msg.sender]);
        _;
    }

    modifier onlyTrustedSource {
        require(isTrustedSource[msg.sender]);
        _;
    }
}

